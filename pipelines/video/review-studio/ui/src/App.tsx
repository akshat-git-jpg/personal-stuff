import { useEffect, useState } from 'react';
import { Home } from './Home';
import { Review } from './Review';

// Hash routes: #/ is the list, #/v/<recipe>/<slug> is one video.
function parse(hash: string) {
  const m = /^#\/v\/([a-z-]+)\/([a-z0-9-]+)/.exec(hash);
  return m ? { recipe: m[1], slug: m[2] } : null;
}

export function App() {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route ? <Review key={`${route.recipe}/${route.slug}`} recipe={route.recipe} slug={route.slug} /> : <Home />;
}

export function Brand() {
  return (
    <a href="#/" className="brand">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="2" y="5" width="22" height="16" rx="3" fill="none" stroke="#fb923c" strokeWidth="2" /><path d="M11 9.5v7l6-3.5z" fill="#fb923c" /></svg>
      <b>Review Studio</b>
    </a>
  );
}
