// Inline global styles since we're in the shadow dom context.
import styles from './Content.css?inline';

export const Content = () => {
  return (
    <>
      <style>{styles}</style>
      {/* All CSS module imports will be inlined into `#shadowDomStyles#` byt the chrome extension. */}
      <style>#shadowDomStyles#</style>
      <div />
    </>
  );
};
