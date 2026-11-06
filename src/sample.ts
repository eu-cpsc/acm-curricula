import { UNITS, type Tier } from './bok'
import { newId, type Course, type Program } from './store'

/** Topic IDs for units whose code starts with any prefix (e.g. "OS-" or "SDF-Fundamentals"). */
function cov(prefixes: string[], tiers: Tier[] = ['cs', 'ka']): string[] {
  return UNITS.filter((u) => prefixes.some((p) => u.code === p || (p.endsWith('-') && u.code.startsWith(p))))
    .flatMap((u) => u.topics)
    .filter((t) => tiers.includes(t.tier))
    .map((t) => t.id)
}

function c(dept: string, number: string, name: string, coverage: string[], credits = 3): Course {
  return { id: newId(), dept, number, name, credits, description: '', coverage }
}

/** Illustrative data so the app can be explored before entering real courses. */
export function sampleProgram(): Program {
  const courses = [
    c('CPSC', '101', 'Introduction to Programming', [...cov(['SDF-Fundamentals', 'SDF-Practices'], ['cs']), ...cov(['SEP-Context'], ['cs'])], 4),
    c('CPSC', '102', 'Data Structures', cov(['SDF-Data-Structures', 'SDF-Algorithms', 'AL-Foundational'], ['cs']), 4),
    c('MATH', '250', 'Discrete Mathematics', cov(['MSF-Discrete'])),
    c('MATH', '310', 'Probability and Statistics', cov(['MSF-Probability', 'MSF-Statistics'])),
    c('CPSC', '220', 'Computer Organization', cov(['AR-', 'SF-Overview', 'SF-Foundations'], ['cs'])),
    c('CPSC', '300', 'Software Engineering', [...cov(['SE-'], ['cs']), ...cov(['SEP-Professional-Ethics'], ['cs'])]),
    c('CPSC', '310', 'Algorithms', cov(['AL-'])),
    c('CPSC', '330', 'Database Systems', cov(['DM-'])),
    c('CPSC', '350', 'Programming Languages', cov(['FPL-'], ['cs'])),
    c('CPSC', '415', 'Operating Systems', [...cov(['OS-']), ...cov(['PDC-Programs', 'PDC-Coordination'], ['cs'])]),
    c('CPSC', '420', 'Computer Networks', cov(['NC-'])),
    c('CPSC', '430', 'Computer Security', cov(['SEC-'])),
    c('CPSC', '440', 'Artificial Intelligence', cov(['AI-'])),
    c('CPSC', '450', 'Computer Graphics', cov(['GIT-'])),
    c('CPSC', '460', 'Web Development', cov(['SPD-Common', 'SPD-Web', 'HCI-Design', 'HCI-User'])),
    c('CPSC', '490', 'Senior Capstone', cov(['SE-Teamwork', 'SEP-Communication', 'SEP-Professional-Ethics'], ['cs'])),
  ]
  const id = (num: string) => courses.find((x) => x.number === num)!.id
  const core = ['101', '102', '250', '310', '220', '300', '350', '415', '490']
  const electives = (choose: number, nums: string[]) => [{ id: newId(), name: 'CS electives', choose, options: nums.map(id) }]
  return {
    format: 'acm-curriculum-planner',
    version: 2,
    institution: 'Sample University',
    name: 'Computer Science',
    courses,
    plans: [
      {
        id: newId(),
        name: 'B.S. Computer Science',
        description: 'General track: core plus three electives.',
        required: core.map(id),
        electives: electives(3, ['330', '420', '430', '440', '450', '460']),
      },
      {
        id: newId(),
        name: 'B.S. Computer Science – Cybersecurity',
        description: '',
        required: [...core, '420', '430'].map(id),
        electives: electives(1, ['330', '440', '450', '460']),
      },
      {
        id: newId(),
        name: 'B.S. Computer Science – AI & Data Science',
        description: '',
        required: [...core, '330', '440'].map(id),
        electives: electives(1, ['420', '430', '450', '460']),
      },
    ],
  }
}
