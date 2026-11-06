import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  roleName: string;
  disabledAt: string | null;
};

export function UsersPage() {
  const query = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<{ items: UserRow[]; total: number }>("/api/v1/users"),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-deep">Users</h1>
      <div className="mt-4 overflow-hidden rounded-card border border-line bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-soft text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">{row.displayName}</td>
                <td className="px-4 py-3">{row.username}</td>
                <td className="px-4 py-3">{row.roleName}</td>
                <td className="px-4 py-3">
                  <span className={row.disabledAt ? "text-danger" : "text-success"}>
                    {row.disabledAt ? "Disabled" : "Active"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
