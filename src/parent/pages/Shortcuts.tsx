import { useCallback, useEffect, useState } from 'react';
import { copyText } from '../../app/clipboard';
import { api, ApiError } from '../../sync/api';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Button,
  Card,
  ConfirmButton,
  Empty,
  Field,
  kit,
  Line,
  Row,
  Rows,
  Section,
  Stack,
  TextInput,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';

/**
 * Siri and Shortcuts: "add milk to the shopping list" without opening anything.
 *
 * A Shortcut on an iPhone sends a line of text to HOMEBASE with a token made here. The token can add things to
 * the shopping lists and can do nothing else; it is shown once, kept in the Shortcut, and can be cancelled here
 * at any time.
 */

interface Token {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function Shortcuts() {
  const parent = useParent();
  const toast = useToast();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState('My iPhone');
  const [made, setMade] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const address = `${window.location.origin}/api/shortcuts/add`;

  const load = useCallback(() => {
    api<{ tokens: Token[] }>('GET', '/shortcuts/tokens')
      .then((reply) => setTokens(reply.tokens))
      .catch(() => setTokens([]));
  }, []);
  useEffect(() => {
    let current = true;
    api<{ tokens: Token[] }>('GET', '/shortcuts/tokens')
      .then((reply) => {
        if (current) setTokens(reply.tokens);
      })
      .catch(() => {
        if (current) setTokens([]);
      });
    return () => {
      current = false;
    };
  }, []);

  const copy = (text: string) =>
    void copyText(text).then((copied) =>
      toast(copied ? 'Copied.' : 'Could not copy. Select it and copy by hand.'),
    );

  return (
    <>
      <PageHead title="Siri and Shortcuts" onBack={() => parent.go('more')} />
      <Card tone="blue">
        <Stack gap="s">
          <p>
            With a Shortcut on your iPhone you can say <strong>“Hey Siri, add to shopping list”</strong>, then
            what you need. It lands on the list at once, on the wall and on both phones.
          </p>
          <p className={styles.itemNote}>
            A web app cannot add itself to the iPhone’s share sheet, and Apple’s Notes app cannot be kept in
            step with anything from outside: for those, use the Share button on a list.
          </p>
        </Stack>
      </Card>

      <Section title="1. Make a token for your phone">
        {problem && (
          <p className={styles.warning} role="alert">
            {problem}
          </p>
        )}
        {made ? (
          <Card tone="honey" testId="token-made">
            <Stack gap="s">
              <p>
                <strong>Copy this now.</strong> It is not shown again. Anyone who has it can add things to
                your shopping lists, and nothing more.
              </p>
              <p
                className={kit.mono}
                style={{ fontSize: 15, overflowWrap: 'anywhere' }}
                data-testid="token-value"
              >
                {made}
              </p>
              <Line>
                <Button tone="primary" onClick={() => copy(made)}>
                  Copy the token
                </Button>
                <Button onClick={() => setMade(null)}>I have it</Button>
              </Line>
            </Stack>
          </Card>
        ) : (
          <Card>
            <Line>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field label="Which phone is it for?">
                  <TextInput
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={40}
                    testId="token-name"
                  />
                </Field>
              </div>
              <Button
                tone="primary"
                disabled={name.trim() === ''}
                testId="token-make"
                onClick={() => {
                  setProblem(null);
                  void api<{ token: string }>('POST', '/shortcuts/tokens', { name: name.trim() })
                    .then((reply) => {
                      setMade(reply.token);
                      load();
                    })
                    .catch((error: unknown) =>
                      setProblem(error instanceof ApiError ? error.message : 'That did not work.'),
                    );
                }}
              >
                Make a token
              </Button>
            </Line>
          </Card>
        )}
      </Section>

      <Section
        title="2. Build the Shortcut"
        hint="In the Shortcuts app on your iPhone. It takes about two minutes."
      >
        <Card>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8 }}>
            <li>
              New Shortcut → add <strong>Ask for Input</strong> (text), with the question “What do we need?”
            </li>
            <li>
              Add <strong>Get Contents of URL</strong>. URL:
              <br />
              <code style={{ overflowWrap: 'anywhere' }}>{address}</code>{' '}
              <Button size="s" tone="quiet" onClick={() => copy(address)}>
                Copy
              </Button>
            </li>
            <li>
              In that step choose Method <strong>POST</strong>; add a header <code>Authorization</code> with
              the value <code>Bearer </code> followed by your token; Request Body <strong>JSON</strong> with
              one field, <code>text</code>, set to the input from step 1.
            </li>
            <li>
              Add <strong>Get Dictionary Value</strong> for <code>message</code>, then{' '}
              <strong>Speak Text</strong> (or Show Result).
            </li>
            <li>
              Name it <strong>Add to shopping list</strong>. Say “Hey Siri, add to shopping list”.
            </li>
          </ol>
        </Card>
        <p className={styles.itemNote}>
          Several things at once work: “milk, eggs and two bread”. To choose a list, add a second JSON field,{' '}
          <code>list</code>, with its name.
        </p>
      </Section>

      <Section title="Your tokens">
        {tokens === null ? (
          <p>One moment…</p>
        ) : tokens.length === 0 ? (
          <Card>
            <Empty title="None yet" />
          </Card>
        ) : (
          <Rows testId="tokens">
            {tokens.map((token) => (
              <Row
                key={token.id}
                title={token.name}
                detail={
                  token.lastUsedAt
                    ? `Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                    : 'Not used yet'
                }
                right={
                  <ConfirmButton
                    size="s"
                    label="Cancel"
                    confirmLabel="Cancel it"
                    onConfirm={() => {
                      void api('DELETE', `/shortcuts/tokens/${token.id}`)
                        .then(() => {
                          toast('Cancelled. That Shortcut no longer works.');
                          load();
                        })
                        .catch(() => toast('That did not work.', { tone: 'problem' }));
                    }}
                  />
                }
              />
            ))}
          </Rows>
        )}
      </Section>
    </>
  );
}
