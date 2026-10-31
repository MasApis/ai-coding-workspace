import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "../components/Alert.js";
import { Skeleton } from "../components/Skeleton.js";
import { getEffectiveSelection } from "../lib/providers.js";
import { BackToProjects, PageHeader } from "./PageBits.js";

export function ChatPage() {
  const { conversationId, projectId } = useParams();
  const selectionQuery = useQuery({ queryKey: ["ai-selection", projectId], queryFn: () => getEffectiveSelection(projectId) });
  const selection = selectionQuery.data ?? null;

  return (
    <div>
      <PageHeader
        title="Chat AI"
        description={
          conversationId
            ? `Percakapan: ${conversationId}`
            : selection
              ? `Siap dengan ${selection.modelId}`
              : "Pilih atau mulai percakapan."
        }
      />
      <div className="flex flex-col gap-4">
        {selectionQuery.isPending && <Skeleton label="Memeriksa konfigurasi AI…" />}
        {!selectionQuery.isPending && !selection && (
          <Alert variant="empty" title="Belum ada provider AI">
            Hubungkan provider di Pengaturan agar Chat AI bisa digunakan.{" "}
            <Link to="/settings" className="font-medium text-accent hover:underline">
              Buka Pengaturan →
            </Link>
          </Alert>
        )}
        {!selectionQuery.isPending && selection && (
          <Alert variant="info" title="Riwayat percakapan hadir di TICKET-014">
            Provider aktif: <span className="font-mono">{selection.modelId}</span> (cakupan {selection.scope}).
          </Alert>
        )}
        <BackToProjects />
      </div>
    </div>
  );
}
