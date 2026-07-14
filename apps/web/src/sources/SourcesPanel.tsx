import { ParseError, type Source } from "@grafture/core";
import { useCallback, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

import { useSchemaStore } from "../store/index.js";
import { BranchIcon, ChevronDownIcon, FileIcon, PanelOpenIcon, PlusIcon } from "../ui/icons.js";
import { addSourceFieldToTable, buildTableFromSource, formatSample } from "./buildFromSource.js";
import { childLabel, groupSources } from "./groupSources.js";
import "./SourcesPanel.css";
import { readAndParseFile } from "./readAndParse.js";

const ACCEPTED_EXTENSIONS = ".csv,.tsv,.xlsx,.xls,.json";

type PanelMessage = { kind: "error"; text: string } | { kind: "info"; text: string } | null;

function rejectionSummary(rejected: Array<{ reason: string }>): string {
  return rejected.map((item) => item.reason).join("; ");
}

function SourceCard({
  sourceId,
  name,
  title,
  kind,
  fieldCount,
  rowCount,
  nestedCount = 0,
  nested = false,
  expanded,
  onToggle,
  onBuildTable,
  onRemove,
  children,
}: {
  sourceId: string;
  name: string;
  /** Full source name for the tooltip — a nested card shows only its JSON key as `name`. */
  title: string;
  kind: string;
  fieldCount: number;
  rowCount: number | undefined;
  /** Child sources unnested from this one; shown as a count so a collapsed group still says so. */
  nestedCount?: number;
  /** A child source, rendered indented under its parent. */
  nested?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onBuildTable: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const meta = [
    ...(nested ? [] : [kind.toUpperCase()]),
    `${fieldCount} fields`,
    // Sources parsed before rowCount existed simply omit the segment.
    ...(rowCount !== undefined
      ? [`${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"}`]
      : []),
    ...(nestedCount > 0 ? [`${nestedCount} nested`] : []),
  ].join(" · ");

  return (
    <article
      className={`sources-panel__source${expanded ? " is-expanded" : ""}${
        nested ? " sources-panel__source--nested" : ""
      }`}
      data-source-id={sourceId}
    >
      <button
        type="button"
        className="sources-panel__source-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="sources-panel__source-icon">
          {nested ? <BranchIcon size={16} /> : <FileIcon size={16} />}
        </span>
        <span className="sources-panel__source-meta">
          <span className="sources-panel__source-name" title={title}>
            {name}
          </span>
          <span className="sources-panel__source-kind">{meta}</span>
        </span>
        <ChevronDownIcon size={16} className="sources-panel__chevron" />
      </button>
      {expanded ? (
        <div className="sources-panel__source-body">
          {children}
          <div className="sources-panel__source-actions">
            <button type="button" className="sources-panel__button" onClick={onBuildTable}>
              Build table
            </button>
            <button
              type="button"
              className="sources-panel__button sources-panel__button--ghost"
              onClick={onRemove}
              aria-label={`Remove ${title}`}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function SourcesPanel({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks drag enter/leave depth so the overlay doesn't flicker as the cursor
  // moves between the pane and its nested children.
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<PanelMessage>(null);
  const [busy, setBusy] = useState(false);
  // Accordion: at most one source expanded at a time. `null` means all collapsed (the default).
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  const sources = useSchemaStore((state) => state.sources);
  const schema = useSchemaStore((state) => state.schema);
  const selection = useSchemaStore((state) => state.selection);
  const addSources = useSchemaStore((state) => state.addSources);
  const removeSource = useSchemaStore((state) => state.removeSource);
  const runActions = useSchemaStore((state) => state.runActions);
  const addField = useSchemaStore((state) => state.addField);
  const selectTable = useSchemaStore((state) => state.selectTable);

  const activeTable = selection.tableId
    ? schema.tables.find((table) => table.id === selection.tableId)
    : undefined;

  // One card per uploaded file, with the sources unnested from a JSON file's array fields nested
  // under it. The panel's file count follows the groups, not the raw source count.
  const groups = useMemo(() => groupSources(sources), [sources]);

  const toggleSource = (sourceId: string) => {
    setExpandedSourceId((current) => (current === sourceId ? null : sourceId));
  };

  const ingestFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) {
        return;
      }

      setBusy(true);
      setMessage(null);

      const errors: string[] = [];
      let added = 0;

      for (const file of list) {
        try {
          const sources = await readAndParseFile(file);
          addSources(sources);
          added += 1;
        } catch (error) {
          const text =
            error instanceof ParseError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to parse file";
          errors.push(`${file.name}: ${text}`);
        }
      }

      if (errors.length > 0) {
        setMessage({ kind: "error", text: errors.join(" ") });
      } else if (added > 0) {
        setMessage({
          kind: "info",
          text:
            added === 1
              ? "File parsed locally — nothing was uploaded."
              : `${added} files parsed locally — nothing was uploaded.`,
        });
      }

      setBusy(false);
    },
    [addSources],
  );

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleBuildTable = (sourceId: string) => {
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source) {
      return;
    }

    const result = buildTableFromSource(runActions, schema, source, sources);

    if (result.rejected.length > 0) {
      setMessage({ kind: "error", text: rejectionSummary(result.rejected) });
      return;
    }

    const newTableId = result.applied[0]?.tableIds[0];
    if (newTableId) {
      selectTable(newTableId);
    }

    setMessage({
      kind: "info",
      text: `Built table "${result.tableName}" from ${source.name}.`,
    });
  };

  const handleAddField = (sourceId: string, fieldName: string) => {
    const source = sources.find((candidate) => candidate.id === sourceId);
    const field = source?.fields.find((candidate) => candidate.name === fieldName);

    if (!field) {
      return;
    }

    const result = addSourceFieldToTable(addField, selection.tableId, field);

    if ("error" in result) {
      setMessage({ kind: "error", text: result.error });
      return;
    }

    if (result.rejected.length > 0) {
      setMessage({ kind: "error", text: rejectionSummary(result.rejected) });
      return;
    }

    setMessage({
      kind: "info",
      text: `Added "${field.name}" to ${activeTable?.name ?? "the active table"}.`,
    });
  };

  const isFileDrag = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  const handleDragEnter = (event: DragEvent) => {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: DragEvent) => {
    if (isFileDrag(event)) {
      event.preventDefault();
    }
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    void ingestFiles(event.dataTransfer.files);
  };

  /** One source card with its clickable field list. Parent and nested cards render identically. */
  const renderCard = (source: Source, opts: { nested?: boolean; nestedCount?: number }) => (
    <SourceCard
      key={source.id}
      sourceId={source.id}
      name={opts.nested ? childLabel(source) : source.name}
      title={source.name}
      kind={source.kind}
      fieldCount={source.fields.length}
      rowCount={source.rowCount}
      {...(opts.nested ? { nested: true } : {})}
      {...(opts.nestedCount ? { nestedCount: opts.nestedCount } : {})}
      expanded={expandedSourceId === source.id}
      onToggle={() => toggleSource(source.id)}
      onBuildTable={() => handleBuildTable(source.id)}
      onRemove={() => removeSource(source.id)}
    >
      <ul className="sources-panel__fields">
        {source.fields.map((field, index) => {
          const sample = formatSample(field);

          return (
            <li key={field.name}>
              <button
                type="button"
                className="sources-panel__field"
                disabled={!selection.tableId}
                title={
                  selection.tableId
                    ? `Add ${field.name} to ${activeTable?.name ?? "active table"}`
                    : "Select an active table first"
                }
                onClick={() => handleAddField(source.id, field.name)}
              >
                <span className={`sources-panel__dot${index === 0 ? " is-pk" : ""}`} aria-hidden />
                <span className="sources-panel__field-name">{field.name}</span>
                <span className="sources-panel__field-type">{field.type}</span>
                <span className="sources-panel__field-sample">
                  {sample !== null ? sample : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </SourceCard>
  );

  if (collapsed) {
    return (
      <aside className="panel panel-rail">
        <button
          type="button"
          className="panel-rail__btn"
          onClick={onToggleCollapse}
          title="Expand sources"
          aria-label="Expand sources panel"
        >
          <PanelOpenIcon size={16} />
        </button>
        <span className="panel-rail__label">Sources</span>
      </aside>
    );
  }

  return (
    <section
      className="panel sources-panel"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="sources-panel__header">
        <div className="sources-panel__title-group">
          <h1 className="sources-panel__title">Sources</h1>
          <span className="sources-panel__subtitle">
            {groups.length} {groups.length === 1 ? "file" : "files"}
          </span>
        </div>
        <div className="sources-panel__header-actions">
          <button
            type="button"
            className="sources-panel__add"
            onClick={openFilePicker}
            disabled={busy}
            aria-label="Add source file"
            title="Add a local file"
          >
            <PlusIcon size={16} />
          </button>
          <button
            type="button"
            className="sources-panel__add"
            onClick={onToggleCollapse}
            aria-label="Collapse sources panel"
            title="Collapse panel"
          >
            <PanelOpenIcon size={16} />
          </button>
        </div>
      </header>
      <div className="panel-body">
        {sources.length === 0 ? (
          <div
            className="sources-panel__dropzone"
            onClick={openFilePicker}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFilePicker();
              }
            }}
          >
            <strong>Drop files here</strong>
            <span>or click to choose CSV, Excel, or JSON</span>
            <span>Parsed in your browser — never uploaded</span>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          className="sources-panel__file-input"
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          disabled={busy}
          onChange={(event) => {
            const { files } = event.target;
            if (files) {
              void ingestFiles(files);
            }
            event.target.value = "";
          }}
        />

        {message ? (
          <p className={`sources-panel__message sources-panel__message--${message.kind}`}>
            {message.text}
          </p>
        ) : null}

        {schema.tables.length > 0 ? (
          <p className="sources-panel__hint">
            {activeTable
              ? `Active table: ${activeTable.name} — click a field below to add it.`
              : "Pick an active table from the canvas, then click a field to add it."}
          </p>
        ) : (
          <p className="sources-panel__hint">
            Build a table from a file, or add tables on the canvas, then add individual fields.
          </p>
        )}

        {sources.length === 0 ? (
          <p className="sources-panel__empty">
            No sources yet. Upload a file to inspect its fields.
          </p>
        ) : (
          groups.map((group) => (
            <div className="sources-panel__group" key={group.root.id}>
              {renderCard(group.root, { nestedCount: group.children.length })}
              {group.children.length > 0 ? (
                <div className="sources-panel__nested">
                  {group.children.map((child) => renderCard(child, { nested: true }))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {dragActive ? (
        <div className="sources-panel__drag-overlay" aria-hidden>
          <div className="sources-panel__drag-card">
            <strong>Drop files to add</strong>
            <span>CSV, Excel, or JSON — parsed in your browser</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
