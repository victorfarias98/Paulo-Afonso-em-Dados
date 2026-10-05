type Readiness = { status: "ok" | "unavailable" };

/** The probe must query required tables as well as verify the connection. */
export async function checkReadiness(probe: () => Promise<unknown>): Promise<Readiness> {
  try {
    await probe();
    return { status: "ok" };
  } catch {
    // Readiness failures are expected during startup. Never publish driver errors.
    return { status: "unavailable" };
  }
}
