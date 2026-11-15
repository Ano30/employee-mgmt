import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./auth/auth.routes";
import { hrRouter } from "./hr/hr.routes";
import { employeeRouter } from "./employee/employee.routes";
import { supervisorRouter } from "./supervisor/supervisor.routes";
import { directorRouter } from "./director/director.routes";
import { developerRouter } from "./developer/developer.routes";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/hr", hrRouter);
app.use("/api/employee", employeeRouter);
app.use("/api/supervisor", supervisorRouter);
app.use("/api/director", directorRouter);
app.use("/api/developer", developerRouter); // <--- THIS IS THE CRUCIAL LINE

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API listening on port ${port}`));
