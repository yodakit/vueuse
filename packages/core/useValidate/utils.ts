import { onScopeDispose, type WatchStopHandle } from 'vue-demi';

const useWatchStopHandlers = () => {
  const watchStopHandlersMap = new Map<string, WatchStopHandle>();

  const deleteWatchStopHandler = (key: string) => {
    const watchStopHandler = watchStopHandlersMap.get(key);
    if (!watchStopHandler) return;

    watchStopHandler();
    watchStopHandlersMap.delete(key);
  };

  const setWatchStopHandler = (key: string, watchStopHandler: WatchStopHandle) => {
    deleteWatchStopHandler(key);
    watchStopHandlersMap.set(key, watchStopHandler);
  };

  onScopeDispose(() => {
    watchStopHandlersMap.clear();
  });

  return {
    setWatchStopHandler,
    deleteWatchStopHandler,
  };
};

export {

  useWatchStopHandlers,
};
