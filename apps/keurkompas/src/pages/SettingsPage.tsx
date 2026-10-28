import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkServer } from '../ai/provider';
import { kickQueue } from '../ai/queue';
import { Layout } from '../components/Layout';
import { Button, Card, SectionHeading, TextField } from '../components/ui';
import { db } from '../db/db';
import { repo } from '../db/repository';
import { oneDriveAccount, signIn, signOut } from '../sync/onedrive';
import { kickSync, useSyncStatus } from '../sync/sync';

const PREVIEW = import.meta.env.VITE_PREVIEW === 'true';

function ServerSettings() {
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const [url, setUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  if (!settings) return null;
  const serverUrl = url ?? settings.serverUrl;
  const appToken = token ?? settings.appToken;

  return (
    <Card>
      <p className="mb-3 text-gray-700">
        De assistent en spraak-naar-tekst draaien op de KeurKompas-server. Vul het adres en de
        app-sleutel in die je bij de installatie kreeg (zie docs/SETUP.md).
      </p>
      <TextField
        label="Serveradres"
        value={serverUrl}
        onChange={setUrl}
        placeholder="https://keurkompas-api….workers.dev"
      />
      <TextField label="App-sleutel" value={appToken} onChange={setToken} />
      <Button
        className="w-full"
        disabled={!serverUrl.trim() || !appToken.trim()}
        onClick={async () => {
          const values = { serverUrl: serverUrl.trim(), appToken: appToken.trim() };
          await repo.saveSettings(values);
          setResult(await checkServer(values));
          void kickQueue();
        }}
      >
        Bewaren en testen
      </Button>
      {result && (
        <p className={`mt-2 font-semibold ${result.ok ? 'text-ok' : 'text-nok'}`}>
          {result.message}
        </p>
      )}
    </Card>
  );
}

function OneDriveSettings() {
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const status = useSyncStatus();
  const [clientId, setClientId] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!settings?.oneDriveClientId) return setAccount(null);
    oneDriveAccount(settings.oneDriveClientId)
      .then((a) => setAccount(a?.username ?? null))
      .catch(() => setAccount(null));
  }, [settings?.oneDriveClientId]);

  if (!settings) return null;
  const id = clientId ?? settings.oneDriveClientId;
  const root = folder ?? settings.oneDriveFolder;

  return (
    <Card>
      <p className="mb-3 text-gray-700">
        Foto’s, notes.md, transcripties en inspection.json worden per keuring in je OneDrive gezet (
        <code>{root}/JJJJMMDD_klant_tank/</code>) en verschijnen via OneDrive op je pc.
      </p>
      <TextField label="Microsoft app-ID (client ID)" value={id} onChange={setClientId} />
      <TextField label="Map in OneDrive" value={root} onChange={setFolder} />
      <label className="mb-3 flex min-h-12 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          className="h-7 w-7"
          checked={settings.uploadAudio}
          onChange={(e) => void repo.saveSettings({ uploadAudio: e.target.checked }).then(kickSync)}
        />
        Ook de audio van spraaknotities uploaden
      </label>
      <Button
        variant="secondary"
        className="mb-3 w-full"
        disabled={!id.trim() || !root.trim()}
        onClick={() =>
          void repo
            .saveSettings({ oneDriveClientId: id.trim(), oneDriveFolder: root.trim() })
            .then(kickSync)
        }
      >
        Bewaren
      </Button>
      {settings.oneDriveClientId &&
        (account ? (
          <div className="space-y-2">
            <p className="font-semibold text-ok">Aangemeld als {account}</p>
            <p className="text-sm">{status.message}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={kickSync}>Nu synchroniseren</Button>
              <Button variant="secondary" onClick={() => void signOut(settings.oneDriveClientId)}>
                Afmelden
              </Button>
            </div>
          </div>
        ) : (
          account === null && (
            <Button className="w-full" onClick={() => void signIn(settings.oneDriveClientId)}>
              Aanmelden bij Microsoft
            </Button>
          )
        ))}
    </Card>
  );
}

export function SettingsPage() {
  const proposed = useLiveQuery(() => db.lessen.filter((l) => l.status === 'voorgesteld').count());
  return (
    <Layout title="Instellingen" back="/">
      {PREVIEW ? (
        <Card className="border-sky-700 bg-sky-50">
          In deze voorbeeldversie gaan vragen naar Claude via de pagina zelf. De server en OneDrive
          stel je in de echte app in.
        </Card>
      ) : (
        <>
          <SectionHeading>Assistent</SectionHeading>
          <ServerSettings />
          <SectionHeading>OneDrive</SectionHeading>
          <OneDriveSettings />
        </>
      )}
      <SectionHeading>Kennis</SectionHeading>
      <div className="space-y-2">
        <Link
          to="/lessen"
          className="flex min-h-14 items-center justify-between rounded-xl border-2 border-gray-300 px-4 font-semibold"
        >
          <span>Lessen (correcties)</span>
          <span>{proposed ? `${proposed} voorgesteld ›` : '›'}</span>
        </Link>
        <Link
          to="/regels"
          className="flex min-h-14 items-center justify-between rounded-xl border-2 border-gray-300 px-4 font-semibold"
        >
          <span>Regels nakijken</span>
          <span>›</span>
        </Link>
      </div>
    </Layout>
  );
}
