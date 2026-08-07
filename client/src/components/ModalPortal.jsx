import { createPortal } from 'react-dom';

/**
 * Renders a modal into <body> instead of where it sits in the tree.
 *
 * Every page wrapper in this app carries `animate-fade-in-up`, and that keyframe
 * ends on `transform: translateY(0)` with `fill-mode: both` — so the transform is
 * still applied after the animation finishes. A transformed ancestor becomes the
 * containing block for `position: fixed` children, which means a `fixed inset-0`
 * overlay is measured against the scrolled content area (offset by the sidebar and
 * header) rather than the viewport. The dialog then lands off-centre.
 *
 * Portalling to <body> takes the overlay out from under that transform, so
 * `inset-0` means the screen again — on every page, whatever it is wrapped in.
 */
export default function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
