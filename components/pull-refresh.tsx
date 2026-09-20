import { RefreshControl, ScrollView, type ScrollViewProps } from "react-native";
import { nothing } from "@/components/nothing-ui";

type PullRefreshProps = ScrollViewProps & {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
};

export function PullRefresh({ refreshing, onRefresh, children, ...props }: PullRefreshProps) {
  return (
    <ScrollView
      {...props}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={nothing.red}
          colors={[nothing.red]}
          progressBackgroundColor={nothing.surface}
          progressViewOffset={-10}
        />
      }
    >
      {children}
    </ScrollView>
  );
}
