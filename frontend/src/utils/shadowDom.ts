import { JSX } from 'solid-js/jsx-runtime';
import { render } from 'solid-js/web';

export const renderShadowDom = (root: Element, code: () => JSX.Element) => {
  root.attachShadow({ mode: 'open' });

  if (root.shadowRoot) {
    render(code, root.shadowRoot);
  }
};
