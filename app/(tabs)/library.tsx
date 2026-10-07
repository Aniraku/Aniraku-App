import { LibraryView } from "@/components/library-view";
import { NativeHeader, NativeScreen } from "@/components/screen";

export default function LibraryTab() {
  return (
    <NativeScreen>
      <NativeHeader eyebrow="LIBRARY" title="My List" />
      <LibraryView variant="tab" />
    </NativeScreen>
  );
}
