// Executa tarefas async com limite de concorrência (respeita rate limits da Insider).
export async function pool<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers: Promise<void>[] = [];
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  for (let w = 0; w < n; w++) {
    workers.push(
      (async () => {
        while (true) {
          const i = next++;
          if (i >= items.length) break;
          results[i] = await task(items[i], i);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}
