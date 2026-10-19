import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePeople } from '@/hooks/use-lookup';
import { roleLookup, roles, useWorkflow, type Role } from '@/lib/workflow-data';

const people: Record<Role, { caption: string; color: string }> = {
  Contributor: { caption: 'Submitter', color: 'bg-purple-700' },
  'Reviewer 1': { caption: 'Reviewer · Manager', color: 'bg-purple-700' },
  SME: { caption: 'SME · Technical', color: 'bg-blue-700' },
  'Final reviewer': { caption: 'Approver · Quality Mgr', color: 'bg-rose-800' },
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
export default function Layout() {
  const { role, setRole, actor, setActor, nameOf } = useWorkflow();
  // People for the current role come from its SharePoint list (Authors, Level 1 Managers, SMEs, Quality Managers).
  const listed = usePeople(roleLookup[role]);
  // Act as the first person in the list until someone is picked, or if the remembered person left the list.
  useEffect(() => {
    if (listed.length && !listed.some((person) => person.email === actor)) setActor(listed[0].email);
  }, [listed, actor, setActor]);
  const navigate = useNavigate();
  const user = people[role];
  const changeRole = (value: string) => { setRole(value as Role); navigate('/'); };
  return <div className="min-h-screen bg-background text-foreground">
    <header className="bg-[#1d2225] text-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-5 px-5 py-4 lg:px-10">
      <NavLink to="/" className="flex shrink-0 items-center gap-3"><span className="text-lg font-bold">Lessons Learned</span><span className="rounded border border-amber-400/50 px-2 py-1 text-xs text-amber-300" title="Sanitized local portfolio build">Portfolio Preview</span></NavLink>
      <nav aria-label="Main navigation" className="order-3 flex w-full gap-5 text-sm font-semibold md:order-none md:w-auto md:self-stretch">
        {[['/', 'Home'], ['/library', 'Lessons Library'], ...(role === 'Final reviewer' ? [['/pipeline', 'Admin']] : [])].map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center border-b-[3px] px-1 pt-1 ${isActive ? 'border-amber-400 text-white' : 'border-transparent text-slate-300 hover:text-white'}`}>{label}</NavLink>)}
      </nav>
      <div className="ml-auto flex items-center gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${user.color}`}>{initials(nameOf(actor))}</span><div><Select value={actor} onValueChange={(value) => { setActor(value); navigate('/'); }}><SelectTrigger aria-label="Signed in as" className="h-7 w-48 border-slate-600 bg-[#30363d] px-2 text-sm text-white"><SelectValue /></SelectTrigger><SelectContent>{listed.map((person) => <SelectItem key={person.email} value={person.email}>{person.name}</SelectItem>)}</SelectContent></Select><p className="mt-0.5 px-2 text-xs font-semibold text-amber-400">{user.caption}</p></div></div>
      <Select value={role} onValueChange={changeRole}><SelectTrigger aria-label="Demo role" className="w-40 border-slate-600 bg-[#30363d] text-white"><SelectValue /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
    </div></header>
    <main className="mx-auto max-w-[1500px] px-5 py-8 lg:px-10"><Outlet /></main>
  </div>;
}
