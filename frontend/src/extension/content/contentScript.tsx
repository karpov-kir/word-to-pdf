import { renderShadowDom } from '../../utils/shadowDom';
import { Content } from './Content';

const root = document.createElement('div');
root.id = 'word-to-pdf-extension-root';
document.body.append(root);

renderShadowDom(root, Content);
