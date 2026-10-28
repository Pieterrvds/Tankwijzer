import { useState, type ReactNode } from 'react';
import { findItem } from '../checklist';
import { BEPO_BOVENGRONDS } from '../checklist/bepo-bovengronds';
import { Layout } from '../components/Layout';
import { SeverityChip } from '../components/RuleNotice';
import { Button, Card, ChoiceField } from '../components/ui';
import { repo } from '../db/repository';
import { nowIso } from '../domain/factories';
import type { OwnerOnlyRule, OwnerSummary, Rule } from '../domain/knowledge';
import { describeCondition } from '../rules/describe';
import { OWNER_ONLY_RULES, RULES, STANDARD_SENTENCES } from '../rules/engine';
import {
  reviewState,
  ruleHash,
  type ReviewState,
  type ReviewableRule,
  type RuleReview,
} from '../rules/review';
import { useRuleReviews } from '../rules/useRules';

const STATE_LABEL: Record<ReviewState, string> = {
  geverifieerd: '✅ Geverifieerd (in de app ingebouwd)',
  akkoord: '✅ Akkoord',
  niet_akkoord: '❌ Niet akkoord',
  te_controleren: 'Nog na te kijken',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <dt className="text-sm font-semibold text-gray-600">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ArticleValue({ article }: { article: string }) {
  return article === 'te bevestigen' ? (
    <span className="te-bevestigen px-1">te bevestigen</span>
  ) : (
    <>{article}</>
  );
}

/** Tankwijzer's wording of the same rule: the inspector approves it together with the rest. */
function OwnerRows({ owner }: { owner: OwnerSummary }) {
  return (
    <Row label="Uitleg voor eigenaars (Tankwijzer)">
      <span className="font-semibold">{owner.title_nl}.</span> {owner.text_nl}{' '}
      <span className="text-gray-700">Waarom: {owner.why_nl}</span>
    </Row>
  );
}

function borderFor(state: ReviewState): string {
  return state === 'akkoord' || state === 'geverifieerd'
    ? 'border-ok'
    : state === 'niet_akkoord'
      ? 'border-nok'
      : 'border-amber-500';
}

/** Verdict buttons and comment, shared by inspector rules and owner-only rules. */
function ReviewControls({
  rule,
  review,
  state,
}: {
  rule: ReviewableRule;
  review: RuleReview | undefined;
  state: ReviewState;
}) {
  const [comment, setComment] = useState(review?.comment ?? '');
  const [editing, setEditing] = useState(state === 'te_controleren');

  function save(verdict: RuleReview['verdict']) {
    void repo
      .saveRuleReview({
        ruleId: rule.id,
        ruleHash: ruleHash(rule),
        verdict,
        comment: comment.trim(),
        reviewedAt: nowIso(),
      })
      .then(() => setEditing(false));
  }

  if (state === 'geverifieerd')
    return <p className="font-semibold text-ok">{STATE_LABEL[state]}</p>;
  if (editing) {
    return (
      <div className="mt-3">
        <label className="mb-3 block">
          <span className="mb-1 block font-semibold">
            Opmerking (wat klopt er niet, juiste artikel, …)
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-xl border-2 border-gray-400 p-3 text-lg"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="danger" onClick={() => save('niet_akkoord')}>
            Klopt niet
          </Button>
          <Button onClick={() => save('akkoord')}>Klopt</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="font-semibold">{STATE_LABEL[state]}</p>
        {review?.comment && <p className="text-gray-700">“{review.comment}”</p>}
      </div>
      <button
        type="button"
        className="min-h-12 px-3 font-semibold text-brand underline"
        onClick={() => setEditing(true)}
      >
        Wijzigen
      </button>
    </div>
  );
}

function RuleCard({ rule, review }: { rule: Rule; review: RuleReview | undefined }) {
  const state = reviewState(rule, review);
  const text = rule.standard_sentence
    ? STANDARD_SENTENCES[rule.standard_sentence]?.text_nl
    : rule.text_nl;

  return (
    <Card className={borderFor(state)}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-bold">{rule.section}</span>
        <SeverityChip severity={rule.severity} />
        {rule.suggest_status && <span className="text-sm font-bold">→ voorstel NVT</span>}
      </div>
      <h3 className="mb-3 text-lg leading-snug font-bold">{rule.title_nl}</h3>
      <dl>
        <Row label="Wanneer">{describeCondition(rule.trigger)}</Row>
        <Row
          label={
            rule.standard_sentence ? 'Tekst (jouw standaardzin)' : 'Tekst (voorstel KeurKompas)'
          }
        >
          <span className={rule.standard_sentence ? '' : 'italic'}>“{text}”</span>
        </Row>
        {rule.owner && <OwnerRows owner={rule.owner} />}
        <Row label="Artikel">
          <ArticleValue article={rule.article} />
        </Row>
        <Row label="Items">
          {rule.items
            .map((id) => `${id.split('.')[0]} ${findItem(BEPO_BOVENGRONDS, id)?.label ?? id}`)
            .join(' · ')}
        </Row>
        {(rule.valid_from || rule.valid_until) && (
          <Row label="Geldig">
            {rule.valid_from ?? '…'} → {rule.valid_until ?? '…'}
          </Row>
        )}
        <Row label="Bron">{rule.source}</Row>
        {rule.note && <Row label="Noot">{rule.note}</Row>}
      </dl>
      <ReviewControls rule={rule} review={review} state={state} />
    </Card>
  );
}

/** A rule only Tankwijzer uses (e.g. inspection frequency): no BEPO trigger, only the owner text. */
function OwnerOnlyCard({ rule, review }: { rule: OwnerOnlyRule; review: RuleReview | undefined }) {
  const state = reviewState(rule, review);
  return (
    <Card className={borderFor(state)}>
      <div className="mb-2 text-sm font-bold">Alleen in Tankwijzer</div>
      <h3 className="mb-3 text-lg leading-snug font-bold">{rule.title_nl}</h3>
      <dl>
        <OwnerRows owner={rule.owner} />
        <Row label="Artikel">
          <ArticleValue article={rule.article} />
        </Row>
        <Row label="Bron">{rule.source}</Row>
        {rule.note && <Row label="Noot">{rule.note}</Row>}
      </dl>
      <ReviewControls rule={rule} review={review} state={state} />
    </Card>
  );
}

/**
 * "Regels nakijken": the inspector confirms every rule before relying on it.
 * Reviews stay on this device; "Kopieer resultaat" hands them to the developer so the
 * confirmed rules can be marked verified_by_user: true in the repo.
 */
export function RulesReviewPage() {
  const reviews = useRuleReviews();
  const [filter, setFilter] = useState<'open' | 'alle'>('open');
  const [copied, setCopied] = useState<string | null>(null);

  const all: ReviewableRule[] = [...RULES, ...OWNER_ONLY_RULES];
  const isOpen = (r: ReviewableRule) => reviewState(r, reviews.get(r.id)) === 'te_controleren';
  const open = all.filter(isOpen).length;
  const shown = RULES.filter((r) => filter === 'alle' || isOpen(r));
  const shownOwnerOnly = OWNER_ONLY_RULES.filter((r) => filter === 'alle' || isOpen(r));

  async function copyResult() {
    const payload = all.flatMap((r) => {
      const review = reviews.get(r.id);
      return review && review.ruleHash === ruleHash(r) ? [review] : [];
    });
    const json = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied('Gekopieerd. Plak het in een bericht naar de ontwikkelaar.');
    } catch {
      setCopied(json);
    }
  }

  return (
    <Layout
      title="Regels nakijken"
      subtitle={`${all.length} regels · ${open} nog na te kijken`}
      back="/instellingen"
    >
      <p className="mb-3 text-gray-700">
        Controleer elke regel: klopt de voorwaarde, de tekst en het artikel? Regels die nog niet
        nagekeken zijn, werken wel, maar worden in de app gemarkeerd als “regel niet nagekeken”. De
        regels zijn gedeeld met Tankwijzer: jouw akkoord geldt ook voor de uitleg aan eigenaars.
      </p>
      <ChoiceField
        label="Tonen"
        allowClear={false}
        value={filter}
        onChange={(v) => v && setFilter(v)}
        options={[
          { value: 'open', label: `Na te kijken (${open})` },
          { value: 'alle', label: `Alle (${all.length})` },
        ]}
      />
      {shown.length + shownOwnerOnly.length === 0 && (
        <Card className="mb-3 border-ok">Alle regels zijn nagekeken. 👍</Card>
      )}
      <div className="space-y-3">
        {shown.map((r) => (
          <RuleCard key={r.id} rule={r} review={reviews.get(r.id)} />
        ))}
      </div>
      {shownOwnerOnly.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-lg font-bold">Alleen voor eigenaars (Tankwijzer)</h2>
          <p className="mb-3 text-gray-700">
            Keuringstermijnen en klevers zoals Tankwijzer ze aan tankeigenaars uitlegt.
          </p>
          <div className="space-y-3">
            {shownOwnerOnly.map((r) => (
              <OwnerOnlyCard key={r.id} rule={r} review={reviews.get(r.id)} />
            ))}
          </div>
        </>
      )}
      <Button variant="secondary" className="mt-6 w-full" onClick={() => void copyResult()}>
        Kopieer resultaat
      </Button>
      {copied && <pre className="mt-2 text-sm whitespace-pre-wrap">{copied}</pre>}
      <p className="mt-2 text-sm text-gray-600">
        Aantal standaardzinnen: {Object.keys(STANDARD_SENTENCES).length}
      </p>
    </Layout>
  );
}
