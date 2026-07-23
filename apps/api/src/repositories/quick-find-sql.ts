import type {
  QuickFindMatchField,
  QuickFindMatchMode
} from '@worktrail/contracts';
import { or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

export const quickFindExcerptMaxCodePoints = 180;
const quickFindExcerptLeadingContextCodePoints = 60;
const omissionMarker = '...';
const excerptBodyWithBothMarkers =
  quickFindExcerptMaxCodePoints - omissionMarker.length - omissionMarker.length;
const excerptBodyWithTrailingMarker =
  quickFindExcerptMaxCodePoints - omissionMarker.length;

export interface QuickFindSearchTerms {
  query: string;
  exactPattern: string;
  prefixPattern: string;
  substringPattern: string;
}

export interface QuickFindSqlField {
  column: SQLWrapper;
  matchField: QuickFindMatchField;
}

export interface QuickFindMatchSqlInput {
  terms: QuickFindSearchTerms;
  key?: QuickFindSqlField;
  primary: QuickFindSqlField;
  narrative?: QuickFindSqlField;
}

export interface QuickFindMatchSql {
  condition: SQL;
  relevanceRank: SQL<number>;
  matchField: SQL<QuickFindMatchField | null>;
  matchMode: SQL<QuickFindMatchMode | null>;
  excerpt: SQL<string | null>;
}

export function escapeLikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function createQuickFindSearchTerms(query: string): QuickFindSearchTerms {
  const escapedQuery = escapeLikeLiteral(query);

  return {
    query,
    exactPattern: escapedQuery,
    prefixPattern: `${escapedQuery}%`,
    substringPattern: `%${escapedQuery}%`
  };
}

export function buildQuickFindMatchSql(input: QuickFindMatchSqlInput): QuickFindMatchSql {
  const keyExact = input.key === undefined
    ? null
    : likeLiteral(input.key.column, input.terms.exactPattern);
  const keyPrefix = input.key === undefined
    ? null
    : likeLiteral(input.key.column, input.terms.prefixPattern);
  const primaryExact = likeLiteral(input.primary.column, input.terms.exactPattern);
  const primaryPrefix = likeLiteral(input.primary.column, input.terms.prefixPattern);
  const primarySubstring = likeLiteral(input.primary.column, input.terms.substringPattern);
  const narrativeSubstring = input.narrative === undefined
    ? null
    : likeLiteral(input.narrative.column, input.terms.substringPattern);
  const condition = or(
    ...(keyPrefix === null ? [] : [keyPrefix]),
    primarySubstring,
    ...(narrativeSubstring === null ? [] : [narrativeSubstring])
  )!;

  const relevanceRank = input.key === undefined
    ? sql<number>`case
        when ${primaryExact} then 2
        when ${primaryPrefix} then 3
        when ${primarySubstring} then 4
        ${narrativeSubstring === null ? sql.empty() : sql`when ${narrativeSubstring} then 5`}
        else 6
      end`.mapWith(Number)
    : sql<number>`case
        when ${keyExact} then 0
        when ${keyPrefix} then 1
        when ${primaryExact} then 2
        when ${primaryPrefix} then 3
        when ${primarySubstring} then 4
        ${narrativeSubstring === null ? sql.empty() : sql`when ${narrativeSubstring} then 5`}
        else 6
      end`.mapWith(Number);

  const matchField = input.key === undefined
    ? sql<QuickFindMatchField | null>`case
        when ${primaryExact} then ${input.primary.matchField}::text
        when ${primaryPrefix} then ${input.primary.matchField}::text
        when ${primarySubstring} then ${input.primary.matchField}::text
        ${
          narrativeSubstring === null
            ? sql.empty()
            : sql`when ${narrativeSubstring} then ${input.narrative!.matchField}::text`
        }
        else null
      end`
    : sql<QuickFindMatchField | null>`case
        when ${keyExact} then ${input.key.matchField}::text
        when ${keyPrefix} then ${input.key.matchField}::text
        when ${primaryExact} then ${input.primary.matchField}::text
        when ${primaryPrefix} then ${input.primary.matchField}::text
        when ${primarySubstring} then ${input.primary.matchField}::text
        ${
          narrativeSubstring === null
            ? sql.empty()
            : sql`when ${narrativeSubstring} then ${input.narrative!.matchField}::text`
        }
        else null
      end`;

  const matchMode = input.key === undefined
    ? sql<QuickFindMatchMode | null>`case
        when ${primaryExact} then 'exact'
        when ${primaryPrefix} then 'prefix'
        when ${primarySubstring} then 'substring'
        ${narrativeSubstring === null ? sql.empty() : sql`when ${narrativeSubstring} then 'substring'`}
        else null
      end`
    : sql<QuickFindMatchMode | null>`case
        when ${keyExact} then 'exact'
        when ${keyPrefix} then 'prefix'
        when ${primaryExact} then 'exact'
        when ${primaryPrefix} then 'prefix'
        when ${primarySubstring} then 'substring'
        ${narrativeSubstring === null ? sql.empty() : sql`when ${narrativeSubstring} then 'substring'`}
        else null
      end`;

  const excerpt = input.narrative === undefined
    ? sql<string | null>`null::text`
    : sql<string | null>`case
        when ${relevanceRank} = 5
          then ${quickFindExcerptSql(input.narrative.column, input.terms.query)}
        else null
      end`;

  return {
    condition,
    relevanceRank,
    matchField,
    matchMode,
    excerpt
  };
}

export function quickFindLifecycleRankSql(archivedCondition: SQLWrapper): SQL<number> {
  return sql<number>`case when ${archivedCondition} then 1 else 0 end`.mapWith(Number);
}

export function quickFindExcerptSql(
  narrativeColumn: SQLWrapper,
  query: string
): SQL<string | null> {
  const normalizedNarrative = sql<string>`btrim(
    regexp_replace(coalesce(${narrativeColumn}, ''), '[[:space:]]+', ' ', 'g')
  )`;
  const matchPosition = sql<number>`strpos(lower(${normalizedNarrative}), lower(${query}))`;
  const excerptStart = sql<number>`greatest(
    1,
    ${matchPosition} - ${quickFindExcerptLeadingContextCodePoints}
  )`;
  const bodyLength = sql<number>`case
    when ${excerptStart} > 1
      then ${excerptBodyWithBothMarkers}::int
    else ${excerptBodyWithTrailingMarker}::int
  end`;

  return sql<string | null>`case
    when ${matchPosition} = 0 then null
    else concat(
      case when ${excerptStart} > 1 then ${omissionMarker} else '' end,
      substring(${normalizedNarrative} from ${excerptStart} for ${bodyLength}),
      case
        when char_length(${normalizedNarrative}) > ${excerptStart} + ${bodyLength} - 1
          then ${omissionMarker}
        else ''
      end
    )
  end`;
}

function likeLiteral(column: SQLWrapper, pattern: string): SQL {
  return sql`${column} ilike ${pattern} escape '\\'`;
}
