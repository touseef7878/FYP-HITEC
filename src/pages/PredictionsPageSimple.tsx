import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PredictionsPageSimple() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    // Test API connection
    fetch("http://localhost:8000/lstm/info")
      .then(response => response.json())
      .then(data => {
        setMessage(`API Connected! Status: ${data.status}`);
      })
      .catch(error => {
        setMessage(`API Error: ${error.message}`);
      });
  }, []);

  return (
    <MainLayout>
      <div className="page-container">
        <h1 className="section-header">Predictions Test Page</h1>
        <Card>
          <CardHeader>
            <CardTitle>API Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{message}</p>
            <Button onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}