import { useAppStore } from "../../store/useAppStore";
import { MeasureTable } from "./MeasureTable";
import { RoomTable } from "./RoomTable";
import { SectionList } from "./SectionList";

export function ChecklistTab() {
  const { currentJob } = useAppStore();
  if (!currentJob) return null;
  return (
    <div className="space-y-4">
      <SectionList job={currentJob} />
      <RoomTable job={currentJob} />
      <MeasureTable job={currentJob} />
    </div>
  );
}
