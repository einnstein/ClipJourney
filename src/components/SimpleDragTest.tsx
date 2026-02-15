// src/components/SimpleDragTest.tsx
// A minimal test to see if drag and drop works at all

import { useState } from 'react';

export default function SimpleDragTest() {
  const [items, setItems] = useState(['Item 1', 'Item 2', 'Item 3']);
  const [dragging, setDragging] = useState<string | null>(null);

  return (
    <div className="p-8">
      <h2 className="text-xl mb-4">Simple Drag Test</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            draggable
            onDragStart={() => {
              console.log('Start:', item);
              setDragging(item);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              console.log('Over:', item);
            }}
            onDrop={(e) => {
              e.preventDefault();
              console.log('Drop on:', item);
              if (dragging && dragging !== item) {
                const newItems = [...items];
                const dragIdx = newItems.indexOf(dragging);
                const dropIdx = newItems.indexOf(item);
                newItems.splice(dragIdx, 1);
                newItems.splice(dropIdx, 0, dragging);
                setItems(newItems);
              }
              setDragging(null);
            }}
            className={`p-4 bg-blue-600 rounded cursor-move ${dragging === item ? 'opacity-50' : ''}`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}