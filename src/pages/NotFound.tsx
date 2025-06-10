
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-5 px-4">
        <div className="h-32 w-32 bg-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-6xl font-bold">404</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
        <p className="text-xl text-muted-foreground mb-6 max-w-md">
          Oops! It seems like the page you're looking for has melted away.
        </p>
        <Button 
          size="lg"
                      className="bg-brand-primary hover:bg-brand-primary-dark"
          onClick={() => navigate("/")}
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
