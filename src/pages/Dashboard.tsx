import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, ClipboardCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { mockSystems, mockReviewCases, mockFindings } from '@/data/mockData';

const stats = [
  {
    title: 'Active Systems',
    value: mockSystems.filter((s) => s.status === 'Active').length,
    icon: Server,
    description: 'Under validated state',
  },
  {
    title: 'Open Reviews',
    value: mockReviewCases.filter((r) => r.status !== 'Completed').length,
    icon: ClipboardCheck,
    description: 'Draft, Under Review, or Pending QA',
  },
  {
    title: 'Open Findings',
    value: mockFindings.filter((f) => f.status !== 'Closed').length,
    icon: AlertTriangle,
    description: 'Requiring attention',
  },
  {
    title: 'Completed Reviews',
    value: mockReviewCases.filter((r) => r.status === 'Completed').length,
    icon: CheckCircle,
    description: 'Successfully closed',
  },
];

const statusColor: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  'Under Review': 'bg-primary/10 text-primary',
  'Pending QA': 'bg-orange-100 text-orange-700',
  Completed: 'bg-green-100 text-green-700',
};

const severityColor: Record<string, string> = {
  Critical: 'bg-destructive/10 text-destructive',
  Major: 'bg-orange-100 text-orange-700',
  Minor: 'bg-yellow-100 text-yellow-700',
  Observation: 'bg-muted text-muted-foreground',
};

export default function Dashboard() {
  const upcomingReviews = mockReviewCases
    .filter((r) => r.status !== 'Completed')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const openFindings = mockFindings.filter((f) => f.status !== 'Closed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of computerized system periodic review status
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingReviews.map((review) => (
                <div
                  key={review.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{review.system_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {new Date(review.due_date).toLocaleDateString()} · {review.reviewer_name}
                    </p>
                  </div>
                  <Badge variant="secondary" className={statusColor[review.status]}>
                    {review.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Open Findings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="space-y-1 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground">{finding.system_name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {finding.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className={severityColor[finding.severity]}>
                    {finding.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
