import { footballApi } from "@/lib/server/football-api";
import Image from "next/image";

export default async function CountrySelector() {
  const data = await footballApi.countries();

  // Filter out any entries that don't have a name or flag
  const countries = data?.response || [];

  return (
    <div className="w-full max-w-[400px] bg-white rounded-md shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Browse by Country
      </h3>

      {/* Scrollable container for desktop */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {countries.map((country) => (
          <button
            key={country.name}
            className="w-full flex items-center gap-3 p-2 rounded-mdg hover:bg-gray-50 transition-colors text-left group"
          >
            {country.flag ? (
              <div className="relative w-6 h-4 overflow-hidden rounded-sm border border-gray-100 flex-shrink-0">
                <img
                  src={country.flag}
                  alt={`${country.name} flag`}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div className="w-6 h-4 bg-gray-100 rounded-sm flex-shrink-0" />
            )}

            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-950">
              {country.name}
            </span>

            {country.code && (
              <span className="text-xs text-gray-200 ml-auto uppercase font-mono">
                {country.code}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
