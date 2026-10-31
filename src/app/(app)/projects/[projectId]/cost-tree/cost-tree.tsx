"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CircleOffIcon,
  EllipsisVerticalIcon,
  LoaderCircleIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { COST_UNITS } from "@/lib/cost-tree/default-template";
import { ancestorIds, buildTree, descendantIds, nextChildCode, type TreeNode } from "@/lib/cost-tree/tree";
import { cn, normalizeForSearch } from "@/lib/utils";
import { addCostItemAction, setCostItemActiveAction } from "../actions";

/** Ekleme / aktif-pasif işlemleri: projede proje kalemleri, Ayarlar'da İKY şablonu (aynı ekran). */
const CostTreeActions = createContext({ add: addCostItemAction, setActive: setCostItemActiveAction });

export function CostTreeActionsProvider({ add, setActive, children }: { add: typeof addCostItemAction; setActive: typeof setCostItemActiveAction; children: ReactNode }) {
  return <CostTreeActions.Provider value={{ add, setActive }}>{children}</CostTreeActions.Provider>;
}

export type CostItemRow = {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  unit: string | null;
  description: string | null;
  active: boolean;
};

type Node = TreeNode<CostItemRow>;

export function CostTree({
  projectId,
  items,
  canEdit,
}: {
  projectId: string;
  items: CostItemRow[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState<{ parent: CostItemRow | null } | null>(null);
  const [toggling, setToggling] = useState<CostItemRow | null>(null);

  const inactiveCount = items.filter((item) => !item.active).length;

  // Arama: eşleşen kalemler ve üst kalemleri görünür, hepsi açık gelir.
  const searchTerm = normalizeForSearch(query.trim());
  const visibleIds = useMemo(() => {
    const pool = items.filter((item) => showInactive || item.active);
    if (!searchTerm) return new Set(pool.map((item) => item.id));
    const result = new Set<string>();
    for (const item of pool) {
      const text = normalizeForSearch(`${item.code} ${item.name} ${item.description ?? ""}`);
      if (text.includes(searchTerm)) {
        result.add(item.id);
        for (const ancestor of ancestorIds(items, item.id)) result.add(ancestor);
      }
    }
    return result;
  }, [items, showInactive, searchTerm]);

  const tree = useMemo(
    () => buildTree(items.filter((item) => visibleIds.has(item.id))),
    [items, visibleIds],
  );

  const isOpen = (id: string) => Boolean(searchTerm) || expanded.has(id);
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const parentIds = items.filter((item) => items.some((child) => child.parentId === item.id)).map((i) => i.id);
  const allOpen = parentIds.every((id) => expanded.has(id));

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kod veya kalem adıyla ara (ör. beton, 02.07)"
            className="pl-9"
            aria-label="Kalem ara"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="h-9 rounded-md border px-3 font-normal">
            <Checkbox checked={showInactive} onCheckedChange={(value) => setShowInactive(value === true)} />
            Pasifleri göster{inactiveCount > 0 && ` (${inactiveCount})`}
          </Label>
          <Button
            variant="outline"
            onClick={() => setExpanded(allOpen ? new Set() : new Set(parentIds))}
            disabled={Boolean(searchTerm)}
          >
            {allOpen ? <ChevronsDownUpIcon /> : <ChevronsUpDownIcon />}
            {allOpen ? "Tümünü kapat" : "Tümünü aç"}
          </Button>
          {canEdit && (
            <Button onClick={() => setAdding({ parent: null })}>
              <PlusIcon />
              Ana grup ekle
            </Button>
          )}
        </div>
      </div>

      <Card className="gap-0 py-1">
        {tree.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {searchTerm ? "Aramaya uyan kalem yok." : "Bu projede maliyet kalemi yok."}
          </p>
        ) : (
          <ul role="tree" aria-label="Maliyet ağacı">
            {tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                isOpen={isOpen}
                onToggle={toggle}
                canEdit={canEdit}
                onAdd={(parent) => setAdding({ parent })}
                onToggleActive={setToggling}
              />
            ))}
          </ul>
        )}
      </Card>

      {adding && (
        <AddItemDialog
          projectId={projectId}
          parent={adding.parent}
          items={items}
          onClose={(added) => {
            if (added && adding.parent) setExpanded((current) => new Set(current).add(adding.parent!.id));
            setAdding(null);
          }}
        />
      )}
      {toggling && (
        <ToggleActiveDialog projectId={projectId} item={toggling} items={items} onClose={() => setToggling(null)} />
      )}
    </>
  );
}

function TreeItem({
  node,
  depth,
  isOpen,
  onToggle,
  canEdit,
  onAdd,
  onToggleActive,
}: {
  node: Node;
  depth: number;
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  canEdit: boolean;
  onAdd: (parent: CostItemRow) => void;
  onToggleActive: (item: CostItemRow) => void;
}) {
  const hasChildren = node.children.length > 0;
  const open = hasChildren && isOpen(node.id);

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={false}>
      <div
        className={cn(
          "flex items-start gap-1 border-b py-1.5 pr-2 last:border-b-0",
          depth === 0 && "bg-muted/40 font-medium",
          !node.active && "text-muted-foreground",
        )}
        style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
      >
        <button
          type="button"
          className={cn("mt-0.5 rounded p-1 hover:bg-accent", !hasChildren && "invisible")}
          onClick={() => onToggle(node.id)}
          aria-label={open ? "Kapat" : "Aç"}
          tabIndex={hasChildren ? 0 : -1}
        >
          {open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
        </button>
        <div
          className={cn("min-w-0 flex-1 py-1", hasChildren && "cursor-pointer")}
          onClick={hasChildren ? () => onToggle(node.id) : undefined}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{node.code}</span>
            <span className={cn("text-sm", !node.active && "line-through")}>{node.name}</span>
            {node.unit && <span className="text-xs text-muted-foreground">({node.unit})</span>}
            {!node.active && (
              <Badge variant="outline" className="text-[10px]">
                Pasif
              </Badge>
            )}
          </div>
          {node.description && (
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">{node.description}</p>
          )}
        </div>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`${node.code} işlemleri`}>
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAdd(node)}>
                <PlusIcon />
                Alt kalem ekle
              </DropdownMenuItem>
              {node.active ? (
                <DropdownMenuItem variant="destructive" onSelect={() => onToggleActive(node)}>
                  <CircleOffIcon />
                  Pasifleştir
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => onToggleActive(node)}>
                  <RotateCcwIcon />
                  Aktifleştir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {open && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              isOpen={isOpen}
              onToggle={onToggle}
              canEdit={canEdit}
              onAdd={onAdd}
              onToggleActive={onToggleActive}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function AddItemDialog({
  projectId,
  parent,
  items,
  onClose,
}: {
  projectId: string;
  parent: CostItemRow | null;
  items: CostItemRow[];
  onClose: (added: boolean) => void;
}) {
  const [code, setCode] = useState(() => nextChildCode(parent?.code ?? null, items.map((i) => i.code)));
  const [name, setName] = useState("");
  const [unit, setUnit] = useState(parent ? "götürü" : "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const actions = useContext(CostTreeActions);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await actions.add(projectId, {
        parentId: parent?.id ?? null,
        code,
        name,
        unit,
        description,
      });
      if (result.ok) onClose(true);
      else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{parent ? "Alt kalem ekle" : "Ana grup ekle"}</DialogTitle>
            <DialogDescription>
              {parent ? `Üst kalem: ${parent.code} ${parent.name}` : "Ağacın en üst seviyesine yeni grup eklenir."}
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <FormField id="item-code" label="Kod" required error={fieldErrors.code}>
              <Input id="item-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
            </FormField>
            <FormField id="item-name" label="Kalem adı" required error={fieldErrors.name}>
              <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={200} />
            </FormField>
          </div>
          <FormField id="item-unit" label="Birim" error={fieldErrors.unit}>
            <NativeSelect id="item-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">— (grup / birimsiz)</option>
              {COST_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="item-description" label="Açıklama" error={fieldErrors.description}>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
              Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActiveDialog({
  projectId,
  item,
  items,
  onClose,
}: {
  projectId: string;
  item: CostItemRow;
  items: CostItemRow[];
  onClose: () => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const activating = !item.active;
  const childCount = descendantIds(items, item.id).length;
  const actions = useContext(CostTreeActions);

  function confirm() {
    startTransition(async () => {
      const result = await actions.setActive(projectId, item.id, activating);
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activating ? "Kalemi aktifleştir" : "Kalemi pasifleştir"}</DialogTitle>
          <DialogDescription>
            {item.code} {item.name}
          </DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <p className="text-sm">
          {activating
            ? `Kalem${childCount > 0 ? ` ve altındaki ${childCount} kalem` : ""} (gerekirse üst kalemleriyle birlikte) yeniden aktif olacak.`
            : `Kalem${childCount > 0 ? ` ve altındaki ${childCount} kalem` : ""} pasifleştirilecek. Pasif kalemler silinmez; “Pasifleri göster” ile görüp tekrar aktifleştirebilirsiniz.`}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant={activating ? "default" : "destructive"} onClick={confirm} disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {activating ? "Aktifleştir" : "Pasifleştir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
