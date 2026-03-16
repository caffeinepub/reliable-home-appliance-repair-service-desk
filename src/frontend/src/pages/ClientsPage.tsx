import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { MapPin, Phone, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteClient, useListClients } from "../hooks/useQueries";

export default function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useListClients();
  const deleteClient = useDeleteClient();
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id: bigint) => {
    try {
      await deleteClient.mutateAsync(id);
      toast.success("Client deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete client");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-foreground">Clients</h1>
        <Button
          size="sm"
          onClick={() => navigate({ to: "/clients/new" })}
          data-ocid="clients.primary_button"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Client
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-ocid="clients.search_input"
          />
        </div>

        {/* Client List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" data-ocid="clients.empty_state">
            <p className="text-muted-foreground">
              {search
                ? "No clients match your search."
                : "No clients yet. Add your first client!"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((client, idx) => (
              <div
                key={client.id.toString()}
                data-ocid={`clients.item.${idx + 1}`}
                className="relative bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
              >
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-xl"
                  onClick={() =>
                    navigate({
                      to: "/clients/$clientId",
                      params: { clientId: client.id.toString() },
                    })
                  }
                  aria-label={`View ${client.name}`}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {client.name}
                    </p>
                    {client.phone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {client.phone}
                        </p>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground truncate">
                          {client.address}
                        </p>
                      </div>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="relative z-10 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors flex-shrink-0"
                        aria-label="Delete client"
                        data-ocid={`clients.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent data-ocid="clients.dialog">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Client</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete <strong>{client.name}</strong>? All associated
                          data will be removed. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-ocid="clients.cancel_button">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(client.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-ocid="clients.confirm_button"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
