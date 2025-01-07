import React, { useEffect, useRef, useState } from 'react';

const STLViewer = ({ url }) => {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const meshRef = useRef(null);

  useEffect(() => {
    const initScene = async () => {
      try {
        const THREE = await import('three');
        
        if (!sceneRef.current) {
          sceneRef.current = new THREE.Scene();
          sceneRef.current.add(new THREE.AmbientLight(0x404040));
          sceneRef.current.add(new THREE.DirectionalLight(0xffffff, 1));
        }

        if (!rendererRef.current) {
          rendererRef.current = new THREE.WebGLRenderer();
          rendererRef.current.setSize(window.innerWidth, window.innerHeight);
          containerRef.current?.appendChild(rendererRef.current.domElement);
        }

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load STL file');
        
        const text = await response.text();
        const geometry = parseSTL(text, THREE);
        
        // Remove previous mesh if it exists
        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
        }

        meshRef.current = new THREE.Mesh(
          geometry,
          new THREE.MeshPhongMaterial({ color: 0x00ff00 })
        );
        
        geometry.computeBoundingBox();
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        meshRef.current.position.sub(center);
        
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        camera.position.z = Math.max(...size.toArray()) * 2;
        
        sceneRef.current.add(meshRef.current);

        // Mouse controls
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        const handleMouseDown = (event) => {
          isDragging = true;
          previousMousePosition = {
            x: event.clientX,
            y: event.clientY
          };
        };

        const handleMouseMove = (event) => {
          if (!isDragging || !meshRef.current) return;
          const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
          };
          meshRef.current.rotation.y += deltaMove.x * 0.01;
          meshRef.current.rotation.x += deltaMove.y * 0.01;
          previousMousePosition = {
            x: event.clientX,
            y: event.clientY
          };
        };

        const handleMouseUp = () => {
          isDragging = false;
        };

        rendererRef.current.domElement.addEventListener('mousedown', handleMouseDown);
        rendererRef.current.domElement.addEventListener('mousemove', handleMouseMove);
        rendererRef.current.domElement.addEventListener('mouseup', handleMouseUp);
        rendererRef.current.domElement.addEventListener('mouseleave', handleMouseUp);
        
        const animate = () => {
          requestAnimationFrame(animate);
          rendererRef.current?.render(sceneRef.current, camera);
        };
        
        animate();
        setError(null);

        return () => {
          rendererRef.current.domElement.removeEventListener('mousedown', handleMouseDown);
          rendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove);
          rendererRef.current.domElement.removeEventListener('mouseup', handleMouseUp);
          rendererRef.current.domElement.removeEventListener('mouseleave', handleMouseUp);
        };
      } catch (err) {
        setError(err.message);
        console.error('STL loading error:', err);
      }
    };

    initScene();

    return () => {
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [url]);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-screen" />;
};

function parseSTL(stl, THREE) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];

  const lines = stl.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('facet normal ')) {
      const normal = line.split(' ').slice(2).map(Number);
      for (let j = 0; j < 3; j++) {
        const vertex = lines[i + 2 + j].split('vertex ')[1].split(' ').map(Number);
        positions.push(...vertex);
        normals.push(...normal);
      }
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

export default STLViewer;