// @ts-nocheck
import React from 'react'
import { type FC } from 'react'
import { Retool } from '@tryretool/custom-component-support'
import STLViewer from './STLViewer';

export const fileViewerSTL: FC = () => {
  const [stlUrl, _setStlUrl] = Retool.useStateString({
    name: 'stlUrl',
    label: '.stl URL'
  });

  // Example STLs
  // https://raw.githubusercontent.com/Buildbee/example-stl/refs/heads/main/ascii-cube.stl
  // https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/stl/ascii/slotted_disk.stl

  return (
    <div className="container mx-auto p-4">
      <h3>Displaying: {stlUrl}</h3>
      <STLViewer url={stlUrl} />
    </div>
  );
}
