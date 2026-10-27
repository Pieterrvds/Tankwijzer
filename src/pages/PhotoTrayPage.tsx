import { Layout } from '../components/Layout';
import { PhotoCaptureButton } from '../components/PhotoCapture';
import { PhotoStrip } from '../components/PhotoStrip';
import { SectionHeading } from '../components/ui';
import { VoiceNoteList } from '../components/VoiceNoteList';
import { InspectionNotFound, Loading } from './NotFound';
import { useInspection } from './useInspection';

/**
 * The "ongesorteerd" tray: quick photos and voice notes taken without choosing an item first.
 * Tap a photo to assign it to a check item. (From M5 the AI proposes the item.)
 */
export function PhotoTrayPage() {
  const { id, inspection } = useInspection();
  if (inspection === undefined) return <Loading />;
  if (inspection === null) return <InspectionNotFound />;

  return (
    <Layout
      title="Ongesorteerd"
      subtitle={inspection.klant}
      back={`/inspectie/${id}`}
      bottom={
        <PhotoCaptureButton
          inspectionId={id}
          itemId={null}
          label="Foto toevoegen"
          className="w-full"
        />
      }
    >
      <p className="mb-2 text-gray-700">
        Tik op een foto om ze aan een checklist-item te koppelen.
      </p>
      <SectionHeading>Foto’s</SectionHeading>
      <PhotoStrip inspection={inspection} itemId={null} />
      <SectionHeading>Spraaknotities</SectionHeading>
      <VoiceNoteList inspection={inspection} itemId={null} />
    </Layout>
  );
}
