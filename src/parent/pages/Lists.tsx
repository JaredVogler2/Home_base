import { useEffect, useState, type FormEvent } from 'react';
import { newId } from '../../../shared/ids';
import type { ShoppingItem, ShoppingList } from '../../../shared/model';
import {
  SHOPPING_CATEGORIES,
  SHOPPING_PICTURES,
  type ShoppingCategory,
  type ShoppingPictureId,
} from '../../../shared/pictures';
import type { Favourite } from '../../../shared/settings';
import { classifyItem, describeItem, listAsText, normalizeItem, parseLines } from '../../../shared/shopping';
import { ShoppingPicture } from '../../art/pictures';
import { api } from '../../sync/api';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Button,
  Card,
  ConfirmButton,
  Empty,
  Field,
  Glyph,
  Line,
  PicturePicker,
  Rows,
  Section,
  Segmented,
  Select,
  Sheet,
  Stack,
  Stepper,
  TextArea,
  TextInput,
  Toggle,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';

/**
 * TO BUY: the family's lists, kept in one place that both phones and the wall see.
 *
 * Adding is one line and Enter; a pasted note becomes one thing per line. What was typed is kept exactly; the
 * aisle and the picture are a guess that can be changed. Nothing here buys anything or opens a shop.
 */

const AISLE: Record<ShoppingCategory, string> = {
  produce: 'Fruit and vegetables',
  dairy: 'Dairy and eggs',
  bakery: 'Bakery',
  pantry: 'Cupboard',
  meat: 'Meat and fish',
  frozen: 'Frozen',
  drinks: 'Drinks',
  household: 'Household',
  baby: 'Baby',
  pets: 'Pets',
  other: 'Everything else',
};

/** A favourite's picture and aisle are kept as plain words; one this version does not know is a plain basket. */
const pictureOf = (favourite: Favourite): ShoppingPictureId =>
  favourite.picture in SHOPPING_PICTURES ? (favourite.picture as ShoppingPictureId) : 'other';
const aisleOf = (favourite: Favourite): ShoppingCategory =>
  (SHOPPING_CATEGORIES as readonly string[]).includes(favourite.category)
    ? (favourite.category as ShoppingCategory)
    : 'other';

interface Suggestion {
  text: string;
  picture: ShoppingPictureId;
  category: ShoppingCategory;
  times: number;
}

export function Lists({ rest }: { rest: string[] }) {
  const parent = useParent();
  const toast = useToast();
  const { view } = parent;
  const lists = view.lists.filter((list) => !list.archived).sort((a, b) => a.sort - b.sort);
  const list = lists.find((candidate) => candidate.id === rest[0]) ?? lists[0];
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [managing, setManaging] = useState(false);
  const [grouping, setGrouping] = useState<'aisle' | 'store' | 'none'>('aisle');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tidying, setTidying] = useState(false);
  const guardian = parent.can('guardian');
  const favourites = view.household.settings.shopping.favourites;

  const listId = list?.id;
  useEffect(() => {
    if (!listId) return;
    let current = true;
    api<{ suggestions: Suggestion[] }>('GET', `/shopping/suggestions?listId=${listId}`)
      .then((reply) => {
        if (current) setSuggestions(reply.suggestions);
      })
      .catch(() => {
        if (current) setSuggestions([]);
      });
    return () => {
      current = false;
    };
  }, [listId, view.rev]);

  const items = list ? view.items.filter((item) => item.listId === list.id) : [];
  const needed = items.filter((item) => item.status === 'needed');
  const requested = items.filter((item) => item.status === 'requested');
  const bought = items
    .filter((item) => item.status === 'checked')
    .sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''));

  const groups = (() => {
    const sorted = [...needed].sort(
      (a, b) => Number(b.priority) - Number(a.priority) || a.createdAt.localeCompare(b.createdAt),
    );
    if (grouping === 'none') return [{ key: 'all', title: '', items: sorted }];
    if (grouping === 'store') {
      const stores = [...new Set(sorted.map((item) => item.store ?? ''))].sort((a, b) =>
        a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
      );
      return stores.map((store) => ({
        key: store || 'any',
        title: store || 'Any shop',
        items: sorted.filter((item) => (item.store ?? '') === store),
      }));
    }
    return SHOPPING_CATEGORIES.map((category) => ({
      key: category,
      title: AISLE[category],
      items: sorted.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  })();

  const addLines = (input: string, via: 'typed' | 'pasted') => {
    if (!list) return;
    const lines = parseLines(input);
    if (lines.length === 0) return;
    for (const line of lines) {
      const guess = classifyItem(line.text);
      parent.tell('shopping.add', {
        itemId: newId(),
        listId: list.id,
        text: line.text,
        quantity: line.quantity,
        unit: line.unit,
        note: null,
        url: null,
        store: null,
        priority: false,
        category: guess.category,
        picture: guess.picture,
        via,
      });
    }
    if (lines.length > 1) toast(`Added ${lines.length} things.`);
  };

  // One tap puts a favourite back on this list, with the picture and aisle it was kept with.
  const addFavourite = (favourite: Favourite) => {
    if (!list) return;
    parent.tell('shopping.add', {
      itemId: newId(),
      listId: list.id,
      text: favourite.text,
      quantity: null,
      unit: null,
      note: null,
      url: null,
      store: null,
      priority: false,
      category: aisleOf(favourite),
      picture: pictureOf(favourite),
      via: 'favourite',
    });
  };
  const waiting = new Set(
    items.filter((item) => item.status === 'needed').map((item) => normalizeItem(item.text)),
  );
  const kept = new Set(favourites.map((favourite) => normalizeItem(favourite.text)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    addLines(text, text.includes('\n') ? 'pasted' : 'typed');
    setText('');
  };

  const share = async () => {
    if (!list) return;
    const words = listAsText(list.name, items);
    try {
      if (navigator.share) await navigator.share({ title: list.name, text: words });
      else {
        await navigator.clipboard.writeText(words);
        toast('Copied. Paste it into a note or a message.');
      }
    } catch {
      // Sharing was cancelled: nothing to say.
    }
  };

  if (!list) {
    return (
      <>
        <PageHead title="To buy" />
        <Card>
          <Empty title="No lists yet">
            {guardian && (
              <Button tone="primary" onClick={() => setManaging(true)}>
                Make a list
              </Button>
            )}
          </Empty>
        </Card>
        {managing && <ManageLists lists={[]} onClose={() => setManaging(false)} />}
      </>
    );
  }

  return (
    <>
      <PageHead
        title="To buy"
        action={
          <Line>
            <Button size="s" tone="quiet" onClick={() => void share()} testId="share-list">
              Share
            </Button>
            {guardian && (
              <Button size="s" tone="quiet" onClick={() => setManaging(true)} testId="manage-lists">
                Lists
              </Button>
            )}
          </Line>
        }
      />

      {lists.length > 1 && (
        <div className={styles.listTabs} role="tablist" aria-label="Lists">
          {lists.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={candidate.id === list.id}
              className={styles.listTab}
              onClick={() => parent.go('lists', candidate.id)}
            >
              {candidate.name}
            </button>
          ))}
        </div>
      )}

      <form className={styles.addRow} onSubmit={submit}>
        <TextInput
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (pasted.includes('\n')) {
              event.preventDefault();
              addLines(pasted, 'pasted');
            }
          }}
          placeholder="Add something… (2 milk, eggs)"
          aria-label={`Add to ${list.name}`}
          enterKeyHint="done"
          autoComplete="off"
          maxLength={400}
          testId="add-item"
        />
        <Button
          type="submit"
          tone="primary"
          aria-label="Add"
          testId="add-item-go"
          disabled={text.trim() === ''}
        >
          {Glyph.plus}
        </Button>
      </form>

      {favourites.length > 0 && (
        <div className={styles.shelf} role="group" aria-label="Favourites" data-testid="favourites">
          <div className={styles.shelfHead}>
            <h3 className={styles.group}>Favourites</h3>
            <button
              type="button"
              className={styles.shelfChange}
              aria-pressed={tidying}
              onClick={() => setTidying(!tidying)}
              data-testid="favourites-change"
            >
              {tidying ? 'Done' : 'Change'}
            </button>
          </div>
          <div className={styles.listTabs}>
            {favourites.map((favourite) => {
              const here = waiting.has(normalizeItem(favourite.text));
              return tidying ? (
                <button
                  key={favourite.text}
                  type="button"
                  className={styles.chip}
                  data-mode="remove"
                  aria-label={`Take ${favourite.text} off the favourites shelf`}
                  data-testid={`unfavourite-${favourite.text}`}
                  onClick={() =>
                    parent.tell('shopping.favourite', {
                      text: favourite.text,
                      picture: pictureOf(favourite),
                      category: aisleOf(favourite),
                      on: false,
                    })
                  }
                >
                  <span className={styles.chipPicture} aria-hidden="true">
                    <ShoppingPicture id={pictureOf(favourite)} />
                  </span>
                  {favourite.text}
                  <span className={styles.chipMark} aria-hidden="true">
                    ×
                  </span>
                </button>
              ) : (
                <button
                  key={favourite.text}
                  type="button"
                  className={styles.chip}
                  disabled={here}
                  aria-label={here ? `${favourite.text}: already on the list` : `Add ${favourite.text}`}
                  data-testid={`favourite-${favourite.text}`}
                  onClick={() => addFavourite(favourite)}
                >
                  <span className={styles.chipPicture} aria-hidden="true">
                    <ShoppingPicture id={pictureOf(favourite)} />
                  </span>
                  {favourite.text}
                  {here && (
                    <span className={styles.chipMark} aria-hidden="true">
                      {Glyph.tick}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {suggestions.some((suggestion) => !kept.has(normalizeItem(suggestion.text))) && (
        <div className={styles.listTabs} role="group" aria-label="You often buy">
          {suggestions
            .filter((suggestion) => !kept.has(normalizeItem(suggestion.text)))
            .slice(0, 8)
            .map((suggestion) => (
              <button
                key={suggestion.text}
                type="button"
                className={styles.listTab}
                onClick={() => addLines(suggestion.text, 'typed')}
              >
                + {suggestion.text}
              </button>
            ))}
        </div>
      )}

      {requested.length > 0 && (
        <Section title="Asked for by the children">
          <Rows>
            {requested.map((item) => (
              <li key={item.id} className={styles.item}>
                <span className={styles.itemPicture}>
                  <ShoppingPicture id={item.picture} />
                </span>
                <span className={styles.itemMain}>
                  <span className={styles.itemText}>{describeItem(item)}</span>
                  <span className={styles.itemNote}>
                    {view.profiles.find((profile) => profile.id === item.requestedBy)?.nickname ?? 'A child'}{' '}
                    asked
                    {item.alsoAsked > 0 ? ` (${item.alsoAsked + 1} times)` : ''}
                  </span>
                </span>
                <span className={styles.pair}>
                  <Button
                    size="s"
                    tone="good"
                    onClick={() => parent.tell('shopping.decide', { itemId: item.id, accept: true })}
                  >
                    Add
                  </Button>
                  <Button
                    size="s"
                    onClick={() => parent.tell('shopping.decide', { itemId: item.id, accept: false })}
                  >
                    No
                  </Button>
                </span>
              </li>
            ))}
          </Rows>
        </Section>
      )}

      {needed.length === 0 && requested.length === 0 ? (
        <Card>
          <Empty picture={<ShoppingPicture id="other" />} title="Nothing to buy">
            <p>Type above, or paste a whole note: each line becomes a thing.</p>
          </Empty>
        </Card>
      ) : (
        <Stack gap="s">
          <Line between>
            <span className={styles.itemNote}>
              {needed.length} to get{bought.length > 0 ? ` · ${bought.length} bought` : ''}
            </span>
            <Select
              label="How the list is grouped"
              value={grouping}
              onChange={setGrouping}
              options={[
                { value: 'aisle', label: 'By aisle' },
                { value: 'store', label: 'By shop' },
                { value: 'none', label: 'As added' },
              ]}
            />
          </Line>
          {groups.map((group) => (
            <Stack key={group.key} gap="s">
              {group.title && <h3 className={styles.group}>{group.title}</h3>}
              <Rows testId={`group-${group.key}`}>
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} onEdit={() => setEditing(item)} />
                ))}
              </Rows>
            </Stack>
          ))}
        </Stack>
      )}

      {bought.length > 0 && (
        <Section
          title="Bought"
          action={
            <ConfirmButton
              size="s"
              label="Clear"
              confirmLabel={`Clear ${bought.length}`}
              tone="plain"
              testId="clear-bought"
              onConfirm={() => parent.tell('shopping.clearChecked', { listId: list.id })}
            />
          }
        >
          <Rows testId="bought">
            {bought.map((item) => (
              <ItemRow key={item.id} item={item} onEdit={() => setEditing(item)} />
            ))}
          </Rows>
        </Section>
      )}

      {editing && (
        <EditItem
          item={view.items.find((candidate) => candidate.id === editing.id) ?? editing}
          lists={lists}
          onClose={() => setEditing(null)}
        />
      )}
      {managing && <ManageLists lists={view.lists} onClose={() => setManaging(false)} />}
    </>
  );
}

function ItemRow({ item, onEdit }: { item: ShoppingItem; onEdit: () => void }) {
  const parent = useParent();
  const checked = item.status === 'checked';
  return (
    <li className={styles.item} data-checked={checked} data-testid={`item-${item.text}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`${describeItem(item)}: ${checked ? 'bought' : 'not bought yet'}`}
        className={styles.check}
        onClick={() => parent.tell('shopping.check', { itemId: item.id, checked: !checked })}
        data-testid={`check-${item.text}`}
      >
        <span className={styles.checkBox}>{checked && Glyph.tick}</span>
      </button>
      <button type="button" className={styles.itemMain} onClick={onEdit} data-testid={`edit-${item.text}`}>
        <span className={styles.itemText}>
          {item.priority && !checked ? '★ ' : ''}
          {describeItem(item)}
        </span>
        <span className="visually-hidden">, edit</span>
        {(item.note || item.store || item.url || item.alsoAsked > 0) && (
          <span className={styles.itemNote}>
            {[
              item.note,
              item.store,
              item.url ? 'has a link' : null,
              item.alsoAsked > 0 ? `asked for ${item.alsoAsked + 1} times` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </button>
      <span className={styles.itemPicture} aria-hidden="true">
        <ShoppingPicture id={item.picture} />
      </span>
    </li>
  );
}

function EditItem({
  item,
  lists,
  onClose,
}: {
  item: ShoppingItem;
  lists: ShoppingList[];
  onClose: () => void;
}) {
  const parent = useParent();
  const toast = useToast();
  const [text, setText] = useState(item.text);
  const [quantity, setQuantity] = useState(item.quantity ?? 0);
  const [unit, setUnit] = useState(item.unit ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [url, setUrl] = useState(item.url ?? '');
  const [store, setStore] = useState(item.store ?? '');
  const [priority, setPriority] = useState(item.priority);
  const [category, setCategory] = useState(item.category);
  const [picture, setPicture] = useState(item.picture);
  const [listId, setListId] = useState(item.listId);
  const [busy, setBusy] = useState(false);
  const shelf = parent.view.household.settings.shopping.favourites;
  const wasFavourite = shelf.some((entry) => normalizeItem(entry.text) === normalizeItem(item.text));
  const [favourite, setFavourite] = useState(wasFavourite);

  const save = async () => {
    // Only what changed is sent, so that two phones changing different things both keep their change.
    const patch: Record<string, unknown> = {};
    if (text.trim() !== item.text) patch.text = text;
    if ((quantity || null) !== item.quantity) patch.quantity = quantity || null;
    if ((unit.trim() || null) !== item.unit) patch.unit = unit.trim() || null;
    if ((note.trim() || null) !== item.note) patch.note = note.trim() || null;
    if ((url.trim() || null) !== item.url) patch.url = url.trim() || null;
    if ((store.trim() || null) !== item.store) patch.store = store.trim() || null;
    if (priority !== item.priority) patch.priority = priority;
    if (category !== item.category) patch.category = category;
    if (picture !== item.picture) patch.picture = picture;
    if (listId !== item.listId) patch.listId = listId;
    // The shelf is its own thing: kept under the words as they now are, with this picture and aisle. If the
    // words changed, the old spelling comes off the shelf so that it does not sit there twice.
    const renamed = normalizeItem(text) !== normalizeItem(item.text);
    if (wasFavourite && (!favourite || renamed))
      parent.tell('shopping.favourite', { text: item.text, picture, category, on: false });
    if (
      favourite &&
      text.trim() !== '' &&
      (!wasFavourite || renamed || 'picture' in patch || 'category' in patch || 'text' in patch)
    )
      parent.tell('shopping.favourite', { text: text.trim(), picture, category, on: true });
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    const ok = await parent.ask('shopping.edit', { itemId: item.id, patch: patch as never });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      title="Edit"
      onClose={onClose}
      testId="edit-item"
      footer={
        <>
          <ConfirmButton
            label="Remove"
            confirmLabel="Remove it"
            testId="remove-item"
            onConfirm={() => {
              parent.tell('shopping.remove', { itemId: item.id });
              toast(`Removed “${item.text}”.`, {
                action: { label: 'Undo', run: () => parent.tell('shopping.restore', { itemId: item.id }) },
              });
              onClose();
            }}
          />
          <Button tone="primary" busy={busy} onClick={() => void save()} testId="save-item">
            Save
          </Button>
        </>
      }
    >
      <Line>
        <PicturePicker kind="shopping" value={picture} onChange={setPicture} label="Picture" />
        <div style={{ flex: 1, minWidth: 180 }}>
          <Field label="What">
            <TextInput
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={120}
              testId="item-text"
            />
          </Field>
        </div>
      </Line>
      <Line>
        <Stepper
          label="How many"
          value={quantity}
          min={0}
          max={99}
          onChange={setQuantity}
          show={(value) => (value === 0 ? '—' : value)}
        />
        <div style={{ width: 120 }}>
          <Field label="Unit">
            <TextInput
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              maxLength={16}
              placeholder="lbs, packs"
            />
          </Field>
        </div>
      </Line>
      <Toggle label="Important" hint="Shown first, with a star." checked={priority} onChange={setPriority} />
      <Toggle
        label="A favourite"
        hint="Kept on a shelf above the list, to put back with one tap."
        checked={favourite}
        onChange={setFavourite}
        testId="item-favourite"
      />
      <Field label="Aisle">
        <Select
          value={category}
          onChange={(next) => {
            setCategory(next);
          }}
          options={SHOPPING_CATEGORIES.map((value) => ({ value, label: AISLE[value] }))}
        />
      </Field>
      <Field label="Shop (optional)">
        <TextInput value={store} onChange={(event) => setStore(event.target.value)} maxLength={40} />
      </Field>
      <Field label="Note (optional)">
        <TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} rows={2} />
      </Field>
      <Field
        label="Link (optional)"
        hint="Kept as a note for you. HOMEBASE never opens it for a child and never buys anything."
      >
        <TextInput
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          maxLength={500}
          placeholder="https://"
        />
      </Field>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
          Open the link
        </a>
      )}
      {lists.length > 1 && (
        <Field label="On the list">
          <Select
            value={listId}
            onChange={setListId}
            options={lists.map((list) => ({ value: list.id, label: list.name }))}
          />
        </Field>
      )}
      <p className={styles.itemNote}>
        Added by {item.addedBy}
        {item.picture in SHOPPING_PICTURES ? '' : ''}.
      </p>
    </Sheet>
  );
}

function ManageLists({ lists, onClose }: { lists: ShoppingList[]; onClose: () => void }) {
  const parent = useParent();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'groceries' | 'general'>('general');
  const [names, setNames] = useState<Record<string, string>>({});
  return (
    <Sheet title="Lists" onClose={onClose} testId="manage-lists-sheet">
      <Stack>
        {lists
          .filter((list) => !list.archived)
          .map((list) => (
            <Line key={list.id}>
              <div style={{ flex: 1 }}>
                <TextInput
                  value={names[list.id] ?? list.name}
                  aria-label={`Name of ${list.name}`}
                  onChange={(event) => setNames({ ...names, [list.id]: event.target.value })}
                  onBlur={() => {
                    const next = (names[list.id] ?? list.name).trim();
                    if (next && next !== list.name)
                      parent.tell('list.update', { listId: list.id, name: next, archived: false });
                  }}
                  maxLength={40}
                />
              </div>
              <ConfirmButton
                size="s"
                label="Put away"
                confirmLabel="Put it away"
                onConfirm={() =>
                  parent.tell('list.update', { listId: list.id, name: list.name, archived: true })
                }
              />
            </Line>
          ))}
        {lists.some((list) => list.archived) && (
          <div>
            <p className={styles.itemNote}>Put away:</p>
            {lists
              .filter((list) => list.archived)
              .map((list) => (
                <Line key={list.id} between>
                  <span>{list.name}</span>
                  <Button
                    size="s"
                    tone="quiet"
                    onClick={() =>
                      parent.tell('list.update', { listId: list.id, name: list.name, archived: false })
                    }
                  >
                    Bring back
                  </Button>
                </Line>
              ))}
          </div>
        )}
        <Card tone="honey">
          <Stack gap="s">
            <Field label="A new list">
              <TextInput
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="Hardware shop, Party…"
              />
            </Field>
            <Segmented
              label="Kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'groceries', label: 'Groceries' },
                { value: 'general', label: 'Anything else' },
              ]}
            />
            <Button
              tone="primary"
              disabled={name.trim() === ''}
              onClick={() => {
                parent.tell('list.create', { listId: newId(), name: name.trim(), kind });
                setName('');
              }}
            >
              Add the list
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Sheet>
  );
}
