export default function MobileProductNav({ onDashboard, onMarket, onCreate, onSettings }) {
  return (
    <nav aria-label="移动端主导航" className="flex h-14 shrink-0 items-center gap-1 border-b border-[#d1d0c9] bg-[#ebe9e0] px-2 md:hidden">
      <button type="button" onClick={onDashboard} className="flex-1 px-2 py-2 text-sm">工作区</button>
      <button type="button" onClick={onMarket} className="flex-1 px-2 py-2 text-sm">人才</button>
      <button type="button" onClick={onCreate} className="flex-1 px-2 py-2 text-sm">创建</button>
      <button type="button" onClick={onSettings} className="flex-1 px-2 py-2 text-sm">设置</button>
    </nav>
  );
}
