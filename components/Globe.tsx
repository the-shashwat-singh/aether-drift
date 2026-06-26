import dynamic from 'next/dynamic';

const Globe = dynamic(() => import(/* webpackChunkName: "globe-cesium" */ './GlobeInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-space-bg">
      <p className="text-sm text-text-secondary">Loading globe…</p>
    </div>
  ),
});

export default Globe;
