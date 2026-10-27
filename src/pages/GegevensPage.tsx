import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ChoiceField, TextField, YesNoField } from '../components/ui';
import { repo } from '../db/repository';
import {
  GhsPictogram,
  VERSLAGNUMMER_PATTERN,
  type Inspection,
  type Product,
  type Tank,
} from '../domain/schemas';
import { formatDecimal, parseDecimal, parseInteger } from '../lib/format';
import { useAutosave } from '../lib/hooks';
import { InspectionNotFound, Loading } from './NotFound';
import { useInspection } from './useInspection';

const TABS = [
  { key: 'algemeen', label: 'Algemeen' },
  { key: 'tank', label: 'Tank' },
  { key: 'product', label: 'Product' },
] as const;

/**
 * Number input that keeps the raw text while typing (so "1," is allowed) and reports the
 * parsed number. Unparseable text is shown as an error and stored as null — never guessed.
 */
function NumberField({
  label,
  value,
  onChange,
  integer = false,
  unit,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  integer?: boolean;
  unit?: string;
}) {
  const [text, setText] = useState(formatDecimal(value));
  const parsed = integer ? parseInteger(text) : parseDecimal(text);
  return (
    <TextField
      label={unit ? `${label} (${unit})` : label}
      value={text}
      inputMode={integer ? 'numeric' : 'decimal'}
      onChange={(t) => {
        setText(t);
        onChange(integer ? parseInteger(t) : parseDecimal(t));
      }}
      error={text.trim() && parsed === null ? 'Geen geldig getal' : null}
    />
  );
}

function AlgemeenForm({ inspection }: { inspection: Inspection }) {
  const [form, setForm] = useState({
    klant: inspection.klant,
    plaatsVanOnderzoek: inspection.plaatsVanOnderzoek,
    datum: inspection.datum,
    verslagnummer: inspection.verslagnummer,
    waterwingebied: inspection.waterwingebied,
  });
  useAutosave(form, (f) => repo.updateInspection(inspection.id, (d) => ({ ...d, ...f })));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((cur) => ({ ...cur, [k]: v }));

  return (
    <>
      <TextField label="Klant" value={form.klant} onChange={(v) => set('klant', v)} />
      <TextField
        label="Plaats van onderzoek"
        value={form.plaatsVanOnderzoek}
        onChange={(v) => set('plaatsVanOnderzoek', v)}
      />
      <TextField label="Datum" type="date" value={form.datum} onChange={(v) => set('datum', v)} />
      <TextField
        label="Verslagnummer"
        value={form.verslagnummer}
        onChange={(v) => set('verslagnummer', v)}
        placeholder="bepo.26.0001"
        error={
          form.verslagnummer && !VERSLAGNUMMER_PATTERN.test(form.verslagnummer)
            ? 'Formaat: bepo.JJ.XXXX'
            : null
        }
      />
      <YesNoField
        label="T2 · Ligging in waterwin- of beschermingsgebied"
        value={form.waterwingebied}
        onChange={(v) => set('waterwingebied', v)}
      />
    </>
  );
}

function TankForm({ inspection }: { inspection: Inspection }) {
  const [tank, setTank] = useState<Tank>(inspection.tank);
  useAutosave(tank, (t) =>
    repo.updateInspection(inspection.id, (d) => {
      d.tank = t;
    }),
  );
  const set = <K extends keyof Tank>(k: K, v: Tank[K]) => setTank((cur) => ({ ...cur, [k]: v }));

  return (
    <>
      <ChoiceField
        label="Plaatsing"
        allowClear={false}
        value={tank.placement}
        onChange={(v) => v && set('placement', v)}
        options={[
          { value: 'bovengronds', label: 'Bovengronds' },
          { value: 'ondergronds', label: 'Ondergronds' },
        ]}
      />
      <ChoiceField
        label="Materiaal"
        value={tank.material}
        onChange={(v) => set('material', v)}
        options={[
          { value: 'staal', label: 'Staal' },
          { value: 'rvs', label: 'RVS' },
          { value: 'gvk', label: 'GVK / polyester' },
          { value: 'thermoplast', label: 'PE / thermoplast' },
          { value: 'ander', label: 'Ander' },
        ]}
      />
      {tank.material === 'ander' && (
        <TextField
          label="Ander materiaal"
          value={tank.materialOther}
          onChange={(v) => set('materialOther', v)}
        />
      )}
      <ChoiceField
        label="Wand"
        value={tank.wall}
        onChange={(v) => set('wall', v)}
        options={[
          { value: 'enkelwandig', label: 'Enkelwandig' },
          { value: 'dubbelwandig', label: 'Dubbelwandig' },
        ]}
      />
      <ChoiceField
        label="Deel van tankenpark (> 250 m³ in één inkuiping)"
        allowClear={false}
        value={tank.deelVanTankenpark ? 'ja' : 'nee'}
        onChange={(v) => set('deelVanTankenpark', v === 'ja')}
        options={[
          { value: 'ja', label: 'Ja' },
          { value: 'nee', label: 'Nee' },
        ]}
      />
      <TextField
        label="Intern tanknummer"
        value={tank.internTanknr}
        onChange={(v) => set('internTanknr', v)}
      />
      <NumberField
        label="Inhoud"
        unit="l"
        value={tank.inhoudLiter}
        onChange={(v) => set('inhoudLiter', v)}
      />
      <NumberField
        label="Bouwjaar"
        integer
        value={tank.bouwjaar}
        onChange={(v) => set('bouwjaar', v)}
      />
      <TextField
        label="Fabricagenummer"
        value={tank.fabricagenr}
        onChange={(v) => set('fabricagenr', v)}
      />
      <TextField
        label="Tankbouwer"
        value={tank.tankbouwer}
        onChange={(v) => set('tankbouwer', v)}
      />
      <TextField
        label="Prototypekeurnummer"
        value={tank.prototypekeurnr}
        onChange={(v) => set('prototypekeurnr', v)}
        placeholder="Bestaande situatie"
      />
      <TextField
        label="Norm / constructiecode"
        value={tank.norm}
        onChange={(v) => set('norm', v)}
      />
      <NumberField
        label="Berekende levensduur"
        unit="jaar"
        integer
        value={tank.levensduurJaar}
        onChange={(v) => set('levensduurJaar', v)}
      />
      <TextField
        label="Afmetingen"
        value={tank.afmetingen}
        onChange={(v) => set('afmetingen', v)}
      />
      <TextField
        label="Ontwerpdruk"
        value={tank.ontwerpdruk}
        onChange={(v) => set('ontwerpdruk', v)}
      />
      <TextField
        label="Ontwerptemperatuur"
        value={tank.ontwerptemp}
        onChange={(v) => set('ontwerptemp', v)}
      />
      <TextField
        label="Ontwerpdichtheid"
        value={tank.ontwerpdichtheid}
        onChange={(v) => set('ontwerpdichtheid', v)}
      />
    </>
  );
}

const GHS_LABEL: Record<GhsPictogram, string> = {
  GHS01: 'GHS01 ontplofbaar',
  GHS02: 'GHS02 ontvlambaar',
  GHS03: 'GHS03 oxiderend',
  GHS04: 'GHS04 gas onder druk',
  GHS05: 'GHS05 corrosief',
  GHS06: 'GHS06 giftig',
  GHS07: 'GHS07 schadelijk',
  GHS08: 'GHS08 gezondheid',
  GHS09: 'GHS09 milieu',
};

function ProductForm({ inspection }: { inspection: Inspection }) {
  const [product, setProduct] = useState<Product>(inspection.product);
  useAutosave(product, (p) =>
    repo.updateInspection(inspection.id, (d) => {
      d.product = p;
    }),
  );
  const set = <K extends keyof Product>(k: K, v: Product[K]) =>
    setProduct((cur) => ({ ...cur, [k]: v }));
  const toggleGhs = (g: GhsPictogram) =>
    set(
      'ghs',
      product.ghs.includes(g) ? product.ghs.filter((x) => x !== g) : [...product.ghs, g].sort(),
    );

  return (
    <>
      <TextField label="Product" value={product.naam} onChange={(v) => set('naam', v)} />
      <NumberField
        label="Vlampunt"
        unit="°C"
        value={product.vlampuntC}
        onChange={(v) => set('vlampuntC', v)}
      />
      <NumberField
        label="Dichtheid"
        unit="kg/m³"
        value={product.dichtheid}
        onChange={(v) => set('dichtheid', v)}
      />
      <NumberField
        label="Dampdruk"
        unit="kPa"
        value={product.dampdrukKpa}
        onChange={(v) => set('dampdrukKpa', v)}
      />
      <YesNoField
        label="Tank in ATEX-zone"
        value={product.atexZone}
        onChange={(v) => set('atexZone', v)}
      />
      <fieldset className="mb-3">
        <legend className="mb-1 font-semibold">GHS-pictogrammen</legend>
        <div className="grid grid-cols-2 gap-2">
          {GhsPictogram.options.map((g) => {
            const active = product.ghs.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={active}
                onClick={() => toggleGhs(g)}
                className={`min-h-12 rounded-xl border-2 px-2 text-left text-sm font-semibold ${
                  active ? 'border-brand bg-brand text-white' : 'border-gray-400 bg-white'
                }`}
              >
                {GHS_LABEL[g]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <TextField
        label="Bron productgegevens (VIB / MSDS)"
        value={product.msdsBron}
        onChange={(v) => set('msdsBron', v)}
      />
    </>
  );
}

export function GegevensPage() {
  const { tab = 'tank' } = useParams();
  const { id, inspection } = useInspection();
  if (inspection === undefined) return <Loading />;
  if (inspection === null) return <InspectionNotFound />;
  const base = `/inspectie/${id}`;

  return (
    <Layout
      title="Gegevens"
      subtitle={inspection.klant}
      back={base}
      bottom={
        <Link
          to={base}
          className="flex min-h-14 items-center justify-center rounded-xl bg-brand font-semibold text-white"
        >
          Naar checklist ›
        </Link>
      }
    >
      <nav className="mb-4 grid grid-cols-3 gap-2" aria-label="Tabbladen">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={`${base}/gegevens/${t.key}`}
            replace
            className={`flex min-h-12 items-center justify-center rounded-xl border-2 font-semibold ${
              tab === t.key ? 'border-brand bg-brand text-white' : 'border-gray-400'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {/* `key` remounts the form per tab so its local state starts from saved data. */}
      {tab === 'algemeen' && <AlgemeenForm key="a" inspection={inspection} />}
      {tab === 'tank' && <TankForm key="t" inspection={inspection} />}
      {tab === 'product' && <ProductForm key="p" inspection={inspection} />}
    </Layout>
  );
}
