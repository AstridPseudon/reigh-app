# Home Page: Structural Decomposition

**Impact**: 9 findings (T3:7, T4:2), 29 weighted points.
**Effort**: Half day. Two T4 components need hook extraction.

## T4 Files

### 1. `PhilosophyPane.tsx` (1103 LOC, 23 hooks, mixed concerns)
- **The largest Home page component**. 23 hooks (4 useEffects, 12 useStates) is extreme.
- **Concerns**: jsx_rendering, data_transforms(8), handlers(9)
- **Fix**:
  1. Extract `usePhilosophyVideoSequence` — video playback state machine (sequence player, auto-advance, intersection observer)
  2. Extract `useComparisonSlider` — slider interaction state (mouse/touch tracking, position, snap)
  3. Split JSX into `HeroVideoSection`, `FeatureGrid`, `ComparisonSlider` sub-components
  4. The 12 useStates suggest many could be consolidated into a reducer

### 2. `HeroSection.tsx` (657 LOC, 22 hooks, complexity:10)
- **22 hooks** (6 useEffects, 12 useStates) — similar problem to PhilosophyPane
- **Fix**:
  1. Extract `useHeroAnimation` — entrance animation state, intersection observer, transition timing
  2. Extract `useHeroVideo` — background video playback, poster loading
  3. Consolidate related useStates into a single state object or reducer

## T3 Files (props bloat)

| File | Props | Notes |
|------|-------|-------|
| `TravelSelector.tsx` | SelectorButtonProps:13, TravelSelectorProps:11 | Each prop is distinct — no drilling. Borderline. |
| `VideoWithPoster.tsx` | VideoWithPosterProps:13 | Standard video component props. Borderline. |
| `InstallInstructionsModal.tsx` | Near-dupe: EdgeAppAvailable ↔ OpenInAppBadge (87%) | Two similar badge components in same file. Extract shared badge layout. |
| `HomePage.tsx` | complexity:8, 7 hooks | Orchestrator — complexity is inherent. Review after T4 decompositions reduce it. |

## Execution Order

1. **PhilosophyPane** — highest weight, most hooks
2. **HeroSection** — second T4
3. **Review T3 files** — many borderline, may auto-resolve

## Verification

```bash
npx tsc --noEmit
python3 -m scripts.decruftify scan --path src/
python3 -m scripts.decruftify show "src/pages/Home" --status wontfix --top 10
```
