/**
 * Microsoft sign-in for OneDrive (MSAL, authorization code + PKCE). The app only asks for
 * "Files.ReadWrite": it can write files to the inspector's own OneDrive, nothing else.
 * Tokens stay on the device; there is no server in between.
 */
import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

const SCOPES = ['Files.ReadWrite'];

let instance: { clientId: string; app: Promise<PublicClientApplication> } | null = null;

function msal(clientId: string): Promise<PublicClientApplication> {
  if (instance?.clientId === clientId) return instance.app;
  const app = (async () => {
    const pca = new PublicClientApplication({
      auth: {
        clientId,
        // "common": works for work/school (Microsoft 365) and personal Microsoft accounts.
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: `${window.location.origin}/`,
      },
      cache: { cacheLocation: 'localStorage' },
    });
    await pca.initialize();
    // Completes a sign-in when the app is opened again after Microsoft's login page.
    const result = await pca.handleRedirectPromise();
    const account = result?.account ?? pca.getAllAccounts()[0] ?? null;
    if (account) pca.setActiveAccount(account);
    return pca;
  })();
  instance = { clientId, app };
  return app;
}

export async function oneDriveAccount(clientId: string): Promise<AccountInfo | null> {
  if (!clientId) return null;
  return (await msal(clientId)).getActiveAccount();
}

export async function signIn(clientId: string): Promise<void> {
  await (await msal(clientId)).loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
}

export async function signOut(clientId: string): Promise<void> {
  const app = await msal(clientId);
  await app.logoutRedirect({ account: app.getActiveAccount() ?? undefined });
}

/** An access token, or null when the inspector has to sign in (again). */
export async function getToken(clientId: string): Promise<string | null> {
  const app = await msal(clientId);
  const account = app.getActiveAccount();
  if (!account) return null;
  try {
    return (await app.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) return null;
    throw e;
  }
}
