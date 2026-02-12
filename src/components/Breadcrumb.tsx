"use client";

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface BreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export default function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
      {path.map((item, index) => (
        <div key={item.id || "root"} className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(item.id)}
            className={`hover:text-blue-600 ${
              index === path.length - 1
                ? "font-semibold text-gray-900"
                : "text-gray-600"
            }`}
          >
            {item.name}
          </button>
          {index < path.length - 1 && (
            <span className="text-gray-400">/</span>
          )}
        </div>
      ))}
    </div>
  );
}
