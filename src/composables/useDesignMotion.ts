/* ============================================================
   ALPHA POS — motion composables (compat re-export)

   The real implementation lives in ./useAlphaMotion.ts (1:1 port of
   .tmp-alpha-design/alpha-design-source/motion.js). This file remains
   so existing imports (router/index.ts, dashboard, shifts-analytics)
   keep working under either path.
   ============================================================ */
export {
  armMotion,
  getPrefersReduced,
  replayMotion,
  useCountUp,
  useShown,
} from './useAlphaMotion'
