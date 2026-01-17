import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Download, Trash2, Eye, Lock, Database, Users, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
              <p className="text-muted-foreground">
                Your privacy and data protection rights under GDPR
              </p>
              <Badge variant="outline" className="mt-2">
                Last updated: {new Date().toLocaleDateString()}
              </Badge>
            </motion.div>
          </div>

          {/* GDPR Rights Summary */}
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Your Data Rights (GDPR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Eye className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">Right to Access</h3>
                    <p className="text-sm text-muted-foreground">
                      Export all your personal data and see what we store about you.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Trash2 className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">Right to Erasure</h3>
                    <p className="text-sm text-muted-foreground">
                      Delete all your data permanently from our systems.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Download className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">Data Portability</h3>
                    <p className="text-sm text-muted-foreground">
                      Download your data in a machine-readable format.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Lock className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">Data Protection</h3>
                    <p className="text-sm text-muted-foreground">
                      Your data is encrypted and securely stored.
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/settings" className="flex-1">
                  <Button className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </Button>
                </Link>
                <Link to="/settings" className="flex-1">
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete My Account
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Data Collection */}
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                What Data We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Account Information</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Username and email address</li>
                  <li>• Account creation date and last login</li>
                  <li>• User role (USER or ADMIN)</li>
                  <li>• Account status (active/inactive)</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-3">Detection Data</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Uploaded images and videos</li>
                  <li>• Detection results and bounding boxes</li>
                  <li>• Confidence scores and classifications</li>
                  <li>• Processing timestamps and metadata</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-3">Analytics & Reports</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Generated reports and their content</li>
                  <li>• Analytics data and statistics</li>
                  <li>• LSTM predictions and forecasts</li>
                  <li>• Usage patterns and trends</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-3">Technical Data</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Session tokens and authentication data</li>
                  <li>• API request logs and system activity</li>
                  <li>• Error logs and debugging information</li>
                  <li>• Performance metrics and usage statistics</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Data */}
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                How We Use Your Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <h3 className="font-medium text-blue-700 mb-2">Primary Purpose</h3>
                <p className="text-sm text-muted-foreground">
                  To provide marine plastic detection services, generate analytics, 
                  and create environmental impact reports.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <h3 className="font-medium text-green-700 mb-2">Service Improvement</h3>
                <p className="text-sm text-muted-foreground">
                  To improve our AI models, enhance detection accuracy, 
                  and develop better prediction algorithms.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <h3 className="font-medium text-purple-700 mb-2">Research & Development</h3>
                <p className="text-sm text-muted-foreground">
                  To conduct research on marine pollution patterns and 
                  contribute to environmental conservation efforts.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Data Security & Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <h3 className="font-medium mb-2">Encryption</h3>
                  <p className="text-sm text-muted-foreground">
                    All data is encrypted in transit (HTTPS) and at rest using industry-standard encryption.
                  </p>
                </div>

                <div className="p-4 rounded-lg border">
                  <h3 className="font-medium mb-2">Access Control</h3>
                  <p className="text-sm text-muted-foreground">
                    Strict role-based access control ensures only authorized users can access data.
                  </p>
                </div>

                <div className="p-4 rounded-lg border">
                  <h3 className="font-medium mb-2">Data Isolation</h3>
                  <p className="text-sm text-muted-foreground">
                    User data is isolated and users can only access their own information.
                  </p>
                </div>

                <div className="p-4 rounded-lg border">
                  <h3 className="font-medium mb-2">Audit Logging</h3>
                  <p className="text-sm text-muted-foreground">
                    All data access and modifications are logged for security monitoring.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle>Data Retention Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <h3 className="font-medium text-yellow-700 mb-2">Active Accounts</h3>
                <p className="text-sm text-muted-foreground">
                  Data is retained as long as your account is active and you continue to use our services.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <h3 className="font-medium text-orange-700 mb-2">Inactive Accounts</h3>
                <p className="text-sm text-muted-foreground">
                  Accounts inactive for more than 2 years may be automatically deactivated with data archived.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <h3 className="font-medium text-red-700 mb-2">Account Deletion</h3>
                <p className="text-sm text-muted-foreground">
                  When you delete your account, all personal data is permanently removed within 30 days.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Contact & Data Protection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  For any questions about this privacy policy, data protection, or to exercise your rights:
                </p>

                <div className="p-4 rounded-lg bg-muted/30">
                  <h3 className="font-medium mb-2">Data Protection Officer</h3>
                  <p className="text-sm text-muted-foreground">
                    Email: privacy@oceanguard.ai<br />
                    Response time: Within 72 hours<br />
                    Available: Monday - Friday, 9 AM - 5 PM UTC
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link to="/settings" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      View My Data
                    </Button>
                  </Link>
                  <Link to="/settings" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
};

export default PrivacyPolicy;