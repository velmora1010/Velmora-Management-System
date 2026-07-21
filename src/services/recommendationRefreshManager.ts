type RefreshListener = (isRefreshing: boolean) => void;

class RecommendationRefreshManager {
  private listeners: Set<RefreshListener> = new Set();
  private refreshing = false;

  public isRefreshing(): boolean {
    return this.refreshing;
  }

  public startRefresh() {
    this.refreshing = true;
    this.notify();
  }

  public completeRefresh() {
    this.refreshing = false;
    this.notify();
  }

  public subscribe(listener: RefreshListener): () => void {
    this.listeners.add(listener);
    listener(this.refreshing);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.refreshing);
      } catch (err) {
        console.error("Error in refresh listener:", err);
      }
    });
  }
}

export const recommendationRefreshManager = new RecommendationRefreshManager();
