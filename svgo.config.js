// svgo.config.js
export default {
  plugins: [
    'preset-default', // Use default plugins for optimization
    {
      name: 'convertPathData',
      params: {
        floatPrecision: 2, // Control precision of path data
      },
    },
    {
      name: 'removeViewBox', // If you want to rely on fontHeight exclusively
      active: false, // Keep viewBox for now to extract it
    },
    {
      name: 'addClassesToSVGElement', // Useful for CSS targeting
      params: {
        className: 'icon',
      },
    },
    {
      name: 'mergePaths', // Merge multiple paths into one
      active: true,
    },
    {
      name: 'removeUselessStrokeAndFill', // Clean up
      active: true,
    },
    {
      name: 'removeEmptyAttrs', // Clean up
      active: true,
    },
    {
      name: ' viewBox', // Ensure viewBox is present
      active: true,
      fn: () => {
        return {
          element: {
            enter(node) {
              if (!node.attributes.viewBox) {
                // Attempt to calculate a viewBox if missing, or assign a default
                // This is complex and often best handled by ensuring input SVGs have it
                console.warn('SVG missing viewBox, attempting to add default.');
                // A very basic example: assume a square based on potential dimensions
                // More robust would involve calculating bounding box.
                node.attributes.viewBox = '0 0 100 100'; // Default, adjust as needed
              }
            },
          },
        };
      },
    },
  ],
};
