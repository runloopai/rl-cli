import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  listAxonEvents,
  getAxon,
  type AxonEvent,
} from "../services/axonService.js";
import { Table, createTextColumn } from "../components/Table.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface AxonEventsScreenProps {
  axonId?: string;
}

const PAGE_SIZE = 20;

export function AxonEventsScreen({ axonId }: AxonEventsScreenProps) {
  const { goBack, params } = useNavigation();
  const id = axonId || (params.axonId as string);

  const [events, setEvents] = React.useState<AxonEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [axonName, setAxonName] = React.useState("");
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  useExitOnCtrlC();

  // Fetch axon name on mount
  React.useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchAxonName = async () => {
      try {
        const axon = await getAxon(id);
        if (!cancelled) {
          setAxonName(axon.name || id);
        }
      } catch {
        // Silently fail, fallback to ID
        if (!cancelled) {
          setAxonName(id);
        }
      }
    };

    fetchAxonName();

    return () => {
      cancelled = true;
    };
  }, [id]);

  React.useEffect(() => {
    if (!id) {
      goBack();
    }
  }, [id, goBack]);

  // Fetch events
  React.useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await listAxonEvents(id, { limit: PAGE_SIZE, offset });
        if (!cancelled) {
          setEvents(result.events);
          setHasMore(result.hasMore);
          setLoading(false);
          setSelectedIndex(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [id, offset, refreshTrigger]);

  useInput((input, key) => {
    if (loading) return;

    if (input === "q" || key.escape) {
      goBack();
    } else if (input === "n" && hasMore) {
      setOffset((prev) => prev + PAGE_SIZE);
    } else if (input === "p" && offset > 0) {
      setOffset((prev) => Math.max(0, prev - PAGE_SIZE));
    } else if (input === "r") {
      setRefreshTrigger((prev) => prev + 1);
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(events.length - 1, prev + 1));
    }
  });

  if (!id) {
    return null;
  }

  const breadcrumbItems = [
    { label: "Axons" },
    { label: axonName || id },
    { label: "Events", active: true },
  ];

  if (loading) {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Loading axon events..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <ErrorMessage message="Failed to load axon events" error={error} />
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.textDim} dimColor>
            Press [r] to retry or [q] to go back
          </Text>
        </Box>
      </>
    );
  }

  const columns = [
    createTextColumn<AxonEvent>(
      "sequence",
      "SEQ",
      (event) => String(event.sequence),
      { width: 8 },
    ),
    createTextColumn<AxonEvent>(
      "timestamp",
      "TIME",
      (event) => new Date(event.timestamp_ms).toLocaleString(),
      { width: 22 },
    ),
    createTextColumn<AxonEvent>("origin", "ORIGIN", (event) => event.origin, {
      width: 16,
    }),
    createTextColumn<AxonEvent>("source", "SOURCE", (event) => event.source, {
      width: 14,
    }),
    createTextColumn<AxonEvent>(
      "event_type",
      "TYPE",
      (event) => event.event_type,
      { width: 18 },
    ),
    createTextColumn<AxonEvent>(
      "payload",
      "PAYLOAD",
      (event) => event.payload,
      { width: 30 },
    ),
  ];

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box marginBottom={1}>
          <Text color={colors.primary} bold>
            {figures.info} Axon Events
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            - Page {pageNumber}
          </Text>
        </Box>

        <Table
          data={events}
          columns={columns}
          selectedIndex={selectedIndex}
          showSelection={true}
          keyExtractor={(event) => String(event.sequence)}
          emptyState={
            <Text color={colors.textDim} dimColor>
              {figures.info} No events found
            </Text>
          }
        />

        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Showing {events.length} events
          </Text>
        </Box>
      </Box>

      <NavigationTips
        tips={[
          { key: "arrows", label: "Navigate events" },
          hasMore ? { key: "n", label: "Next page" } : null,
          offset > 0 ? { key: "p", label: "Previous page" } : null,
          { key: "r", label: "Refresh" },
          { key: "q", label: "Back" },
        ].filter((tip): tip is { key: string; label: string } => tip !== null)}
      />
    </>
  );
}
