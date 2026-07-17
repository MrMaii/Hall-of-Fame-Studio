import { ListChecks } from 'lucide-react';

function taskLabel(task = {}) {
  return task.title || task.name || task.summary || task.description || '待处理工作';
}

export default function ProjectTaskList({ tasks = [] }) {
  const openTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task.status !== 'done')
    .slice(0, 4);
  const visibleTasks = openTasks.length
    ? openTasks
    : [{ id: 'next', title: '进入项目会议，确认下一项工作和负责人。' }];

  return (
    <section data-testid="project-task-list" className="border border-[#d1d0c9] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm text-[#6b665c]"><ListChecks size={16} /> 当前工作</div>
      <h2 className="mt-2 font-serif text-3xl">下一步要做的事</h2>
      <div className="mt-5 divide-y divide-[#e1ded5] border-y border-[#e1ded5]">
        {visibleTasks.map((task) => (
          <div key={task.id || taskLabel(task)} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="break-words font-serif text-lg">{taskLabel(task)}</div>
              {task.owner && <div className="mt-1 break-words text-sm text-[#6b665c]">负责人：{task.owner.name || task.owner}</div>}
            </div>
            <span className="shrink-0 text-sm text-[#8f1e18]">{task.status === 'blocked' ? '需要处理' : '待进行'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
