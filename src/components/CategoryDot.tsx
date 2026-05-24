import { CATEGORY_COLOR, type Category } from "../types";

export function CategoryDot({ category, size = 10 }: { category: Category; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block flex-shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: CATEGORY_COLOR[category],
      }}
    />
  );
}

export function CategoryTag({ category }: { category: Category }) {
  const color = CATEGORY_COLOR[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color,
        backgroundColor: `${color}1A`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {category}
    </span>
  );
}
