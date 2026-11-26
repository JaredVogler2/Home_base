import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import { Card, Stack } from '../ui/kit';

/** The planning helper's page. The helper itself is added by the copilot work; until then this says so plainly. */
export function Helper() {
  const parent = useParent();
  return (
    <>
      <PageHead title="The planning helper" onBack={() => parent.go('more')} />
      <Card>
        <Stack gap="s">
          <p>
            <strong>Off.</strong> Everything in HOMEBASE works without it.
          </p>
          <p>The optional helper is not set up on this HOMEBASE yet.</p>
        </Stack>
      </Card>
    </>
  );
}
