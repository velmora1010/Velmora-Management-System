# Website Sales Regression Checklist

> [!IMPORTANT]
> **CRITICAL RULE:**
> For ANY future Website Sales change:
> **DO NOT DELETE, DO NOT REVERT, DO NOT OVERWRITE, DO NOT REPLACE** existing working functionality.

## 🔄 Pre-Merge Workflow
1. Run `git fetch origin`
2. Create a clean branch from the latest `origin/main` (the source of truth)
3. Implement only the new change/fix (apply the smallest possible diff)
4. Never copy entire Sales files from old branches
5. Update your feature branch with the latest `main` before merging
6. Review the `git diff` for any removed/reverted Sales features
7. Run through this Website Sales regression checklist
8. Run `npm run build` to verify compilation passes with zero errors
9. Conduct live browser verification
10. Only then merge into `main`

---

## 📋 Feature Regression Checklist

### 1. Core Pages & Layout
- [ ] Dashboard is accessible and displays correctly.
- [ ] Upload Orders processes files successfully.
- [ ] Files page displays imported batches, raw data, and consolidated data tables.
- [ ] Analytics shows graphs and charts without empty pages.

### 2. Date Range Picker
- [ ] Sidebar contains exactly 8 quick range buttons:
  1. Today
  2. Yesterday
  3. This Week
  4. Last 7 Days
  5. This Month
  6. Previous Month
  7. Last 30 Days
  8. This Year
- [ ] "Previous Month" is visible in both Dashboard and Analytics.
- [ ] Selecting "Previous Month" accurately resolves to the full prior month (e.g. Aug 10 -> Jul 1 - Jul 31).
- [ ] Switching tabs between Dashboard and Analytics preserves the selected date range.

### 3. Data Pagination & Row Support
- [ ] Support for query results with >1000 orders works via `fetchAllPages`.
- [ ] Full pagination operates smoothly on data grids without freezing.

### 4. Filters & Search
- [ ] Clicking **Apply Filters** updates dashboard/analytics charts, metrics, and tables immediately.
- [ ] Clicking **Reset Filters** clears selections but maintains the active date range.
- [ ] State -> City -> Pincode dropdowns cascade correctly.
- [ ] Location filtering matches case-insensitively (e.g. "Chennai", "chennai", "CHENNAI" match the same city).

### 5. Payment breakdown Cards (Prepaid & COD)
- [ ] **Prepaid Orders:** Displays count, Prepaid Revenue amount (`₹[Amount]`), and label "Prepaid Order Value".
- [ ] **Partial COD Orders:** Displays count, Partial COD Revenue amount, and remaining COD amount.
- [ ] **Full COD Orders:** Displays count, Full COD Revenue amount, and full COD pending amount.
- [ ] **Total COD Receivable:** Displays total pending COD (Partial remaining + Full COD pending).
- [ ] Revenue amounts are always visible, even when they are 0.
- [ ] Payment summaries are calculated from a unified function (`calculateWebsitePaymentSummary`).

### 6. Verification
- [ ] Build compiles successfully via `npm run build` with 0 errors.
