import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AuthController } from "../controllers/auth.controller.js";

const authRoute: FastifyPluginAsync = async (app: FastifyInstance) => {
    
    
    
    app.post("/login", AuthController.login);
    app.post("/register", AuthController.register); // New self-registration route
    app.post("/refresh", AuthController.refresh);
    app.post("/logout", AuthController.logout);
    app.put("/update-password", AuthController.updatePassword);
    app.post("/forgot-password", AuthController.forgotPassword);
};

export default authRoute;
