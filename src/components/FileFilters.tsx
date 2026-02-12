"use client";

interface FileFiltersProps {
  fileType: string;
  onFileTypeChange: (type: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
}

export default function FileFilters({
  fileType,
  onFileTypeChange,
  sortBy,
  onSortByChange,
}: FileFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      {/* 파일 타입 필터 */}
      <div>
        <label className="text-sm text-gray-600 mr-2">타입:</label>
        <select
          value={fileType}
          onChange={(e) => onFileTypeChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          <option value="image">이미지</option>
          <option value="video">동영상</option>
          <option value="document">문서</option>
        </select>
      </div>

      {/* 정렬 */}
      <div>
        <label className="text-sm text-gray-600 mr-2">정렬:</label>
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="createdAt-desc">최신순</option>
          <option value="createdAt-asc">오래된순</option>
          <option value="originalName-asc">이름 (가나다순)</option>
          <option value="originalName-desc">이름 (역순)</option>
          <option value="size-desc">크기 (큰 순)</option>
          <option value="size-asc">크기 (작은 순)</option>
        </select>
      </div>
    </div>
  );
}