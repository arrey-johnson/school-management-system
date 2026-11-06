export type SequenceState = {
  name: string;
  prefix: string;
  nextValue: number;
  padding: number;
};

export function formatSequenceNumber(state: SequenceState): string {
  if (!Number.isInteger(state.nextValue) || state.nextValue < 1) {
    throw new Error("Sequence nextValue must be an integer >= 1");
  }
  const body = String(state.nextValue).padStart(state.padding, "0");
  return `${state.prefix}${body}`;
}

export function peekNextNumber(state: SequenceState): { formatted: string; nextState: SequenceState } {
  const formatted = formatSequenceNumber(state);
  return {
    formatted,
    nextState: { ...state, nextValue: state.nextValue + 1 },
  };
}
