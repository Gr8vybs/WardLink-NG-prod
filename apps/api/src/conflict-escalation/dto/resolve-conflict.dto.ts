export class ResolveConflictDto {
  /** The value the resolver has chosen — either one of the competing
   * values verbatim, or a new merged/corrected value they typed in. */
  resolutionValue: string;
}