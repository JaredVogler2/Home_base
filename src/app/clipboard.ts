/**
 * Copy words for pasting somewhere else. The modern way is withheld from a page that was not fetched securely
 * (a house tried at a plain http address on the home network), so the old way stands behind it. Says whether
 * it worked, so that "Copied." is only ever said when it is true.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused or not allowed just now: try the old way.
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
}
