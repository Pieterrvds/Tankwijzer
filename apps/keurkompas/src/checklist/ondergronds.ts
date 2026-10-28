/**
 * ⚠️ PLACEHOLDER — checklist for UNDERGROUND tanks (ondergrondse houders).
 *
 * Underground tanks have their own checks under VLAREM II hfdst. 5.17. The MVP report target
 * is the BEPO for above-ground tanks, so this module only lets the inspector capture photos,
 * voice notes and free remarks for an underground tank.
 *
 * TODO(user): provide the requirements / report template for underground tanks, then replace
 * these placeholder items with the real sections. Keep it in this separate module.
 */
import type { Checklist } from './types';

export const ONDERGRONDS_PLACEHOLDER: Checklist = {
  id: 'ondergronds-placeholder',
  title: 'Ondergrondse houder (voorlopige checklist)',
  sections: [
    {
      code: 'T6',
      title: 'Vaststellingen (voorlopig)',
      intro:
        'De checklist voor ondergrondse houders is nog niet uitgewerkt. Leg foto’s, spraaknotities en opmerkingen vast; de regels volgen later.',
      items: [
        {
          id: 'OG.algemeen',
          section: 'T6',
          slug: 'ondergronds',
          label: 'Algemene vaststellingen ondergrondse houder',
        },
        { id: 'OG.lekdetectie', section: 'T6', slug: 'lekdetectie', label: 'Lekdetectie' },
        {
          id: 'OG.overvulling',
          section: 'T6',
          slug: 'overvulling',
          label: 'Systeem tegen overvulling',
        },
        { id: 'OG.mangat', section: 'T6', slug: 'mangat', label: 'Mangat / domschacht' },
      ],
    },
  ],
};
